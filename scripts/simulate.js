// Simulação de balanceamento: um bot joga usando só o core (sem terminal) e mede quando
// chega a cada marco. Serve para ajustar as curvas em src/data/ com números, não no olho.
//
//   bun scripts/simulate.js [minutos=90] [--seeds=5] [--crises=play|idle|off] [--runs=1]
//                           [--play=active|idle] [--chapter=earth|solar|galaxy]
//                           [--challenge=<id> --tier=1..5 | --daily=AAAA-MM-DD]
// Com desafio ou semente do dia, o bot joga a partida especial (sem legado) e mostra
// quanto tempo levou até a meta.
//
// Bot: perde uma parte das crises conforme o nível delas (FAIL_PER_LEVEL); gira a
// manivela nos 5 primeiros minutos, pesquisa tudo que puder, compra a fonte
// com mais kW médio por $ (MAX), upgrades, laboratório, resfriamento e transformadores
// quando custam uma fração pequena do saldo. Ascende quando a prévia rende pelo menos
// metade dos pontos já recebidos (ascender a cada ponto novo seria pouco humano).
// Na loja, gasta metade dos pontos e ergue o Monumento só quando ele rende mais que
// guardar os pontos que custa.
//
// Mercado e manutenção (1.5), conforme --play:
//   idle    contrata a equipe de manutenção e esquece; sem baterias nem contratos
//   active  manutenção à mão (uma a cada HAND_EVERY s, quando passa de 25%), bancos de
//           bateria quando baratos, venda no surto ou no preço alto, carga barata ligada e
//           contratos (aceita a oferta de maior prêmio por segundo)
import { fileURLToPath } from 'node:url';
import { newState } from '../src/core/state.js';
import * as E from '../src/core/engine.js';
import * as A from '../src/core/actions.js';
import { autoStep, autoCrankStep } from '../src/core/automation.js';
import * as H from '../src/core/heat.js';
import * as I from '../src/core/incidents.js';
import * as P from '../src/core/prestige.js';
import { checkAchievements } from '../src/core/achievements.js';
import { GENERATORS } from '../src/data/generators.js';
import { TECHS } from '../src/data/research.js';
import { SHOP, LEGACY, MONUMENT } from '../src/data/legacy.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { applyRunStart, goalReached, runGoal, dailySeed } from '../src/core/challenges.js';
import { contractsStep, accept } from '../src/core/contracts.js';
import { breakdownStep, wearLevel, brokenCount } from '../src/core/wear.js';
import { rand as marketRand, surging, bankCost, canBuyBank } from '../src/core/market.js';
import { BATTERY } from '../src/data/market.js';

const DT = 0.1;
const FAIL_PER_LEVEL = 0.03;
const HAND_EVERY = 5;
const SAVE_FOR = 300;

// Sorte do próprio bot (erros nas crises), separada da sorte do jogo para não mudar a
// sequência de eventos da partida.
let botSeed = 1;
function botRand() {
  let t = (botSeed = (botSeed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shop(s) {
  // Gasta metade dos pontos (do mais barato para o mais caro) e guarda o resto como bônus.
  const keep = Math.floor(s.legacy.points / 2);
  for (;;) {
    const opts = SHOP.map((it) => ({ it, c: P.nextShopCost(s, it) }))
      .filter((o) => o.c != null && s.legacy.points - o.c >= keep)
      .sort((a, b) => a.c - b.c);
    if (!opts.length) break;
    P.buyShop(s, opts[0].it.id);
  }
  const b = LEGACY.bonusPerPoint;
  for (;;) {
    const c = P.monumentCost(s);
    const p = s.legacy.points;
    if (c > p || (1 + b * (p - c)) * MONUMENT.mult <= 1 + b * p) return;
    P.buyMonument(s);
  }
}

const shopDone = (s) => SHOP.every((it) => P.shopLevel(s, it) >= it.costs.length);

// Mercado e manutenção. `bot` guarda o relógio da manutenção à mão.
function marketBot(s, play, bot) {
  breakdownStep(s, DT, () => marketRand(s));
  contractsStep(s);
  if (play === 'idle') {
    s.wear.crew = true;
    return;
  }
  if (s.t >= bot.hand) {
    const g = GENERATORS.filter((x) => s.owned[x.id] > 0)
      .sort((a, b) => (brokenCount(s, b) - brokenCount(s, a)) || (wearLevel(s, b) - wearLevel(s, a)))[0];
    if (g && (brokenCount(s, g) || wearLevel(s, g) > 0.25)) { A.handClean(s, g.id); bot.hand = s.t + HAND_EVERY; }
  }
  const b = s.market.battery;
  if (canBuyBank(s) && bankCost(s) < s.money * 0.1) A.buyBank(s);
  b.cheap = true;
  if (b.kwh > 0 && (surging(s) || E.price(s) >= E.priceBase(s) * BATTERY.autoAbove)) E.sellBattery(s);
  const c = s.market.contracts;
  if (!c.active && c.offers.length) {
    const value = (o) => (o.reward.money ?? o.reward.rp * 50) / o.duration;
    const best = c.offers.map((o, i) => ({ i, v: value(o) })).sort((x, y) => y.v - x.v)[0];
    accept(s, best.i);
  }
}

// Compras com dinheiro: laboratório, upgrades, resfriamento, transformador e a fonte com
// mais kW médio por $.
function shopping(s) {
  if (E.labUnlocked(s) && E.labCost(s) < s.money * 0.2) A.buyLab(s);
  for (const g of GENERATORS) {
    if (s.owned[g.id] < 1) continue;
    const u = E.nextUpgrade(s, g);
    if (u && u.cost < s.money * 0.3) A.buyUpgrade(s, g.id);
    if (H.isHot(g)) {
      const c = H.nextCooling(s, g);
      if (c && H.heatTarget(s, g, E.genModMult(s, g, 'output')) > 0.8 && c.cost < s.money * 0.5) A.buyCooling(s, g.id);
    }
  }
  if (E.gridLoad(s) > 1 && E.transformerCost(s) < s.money * 0.1) A.buyTransformer(s);
  let best = null;
  let bestV = 0;
  for (const g of GENERATORS) {
    if (!E.genBuyable(s, g)) continue;
    // Kugelblitz mal alimentado rende menos: o bot só amplia com folga de alimentação.
    if (E.feedFactor(s, g) < 0.95) continue;
    const v = (g.output * E.genModMult(s, g, 'output') * E.genEnv(s, g, true)) / E.genCost(s, g);
    if (v > bestV) { bestV = v; best = g; }
  }
  if (best) A.buyGenBulk(s, best.id, 'max');
}

function botStep(s, crises, play, bot) {
  // Com a manivela automática o bot para de girar: um humano também pararia.
  if (s.stats.playTime < 300 && !P.shopPerk(s, 'crank').autoCrank && Math.round(s.t / DT) % 3 === 0) A.crank(s);
  for (const t of TECHS) if (E.techVisible(t, s) && s.rp >= E.techCost(s, t)) A.buyTech(s, t.id);
  // Região: com a rede cheia, junta dinheiro para a concessão (sem comprar nada) se ela
  // couber em até SAVE_FOR s de renda; senão segue comprando e expande quando der.
  const saving = A.canExpand(s) && A.expandCost(s) <= E.income(s) * SAVE_FOR;
  if (A.canExpand(s) && s.money >= A.expandCost(s)) A.expandRegion(s);
  if (!saving) shopping(s);
  E.tick(s, DT);
  marketBot(s, play, bot);
  autoStep(s, DT);
  autoCrankStep(s, DT);
  checkAchievements(s);
  if (crises === 'off') return;
  I.eventsStep(s, DT);
  // "play" joga na hora, como um humano atento: perde FAIL_PER_LEVEL × nível das crises
  // (nível 0 nunca, nível 10 ~30%); "idle" deixa a equipe resolver no prazo.
  if (crises === 'play' && s.events.crisis) {
    I.beginCrisis(s);
    s.events.crisis.game.status = botRand() < FAIL_PER_LEVEL * I.crisisLevel(s) ? 'lost' : 'won';
    I.eventsStep(s, 0);
  }
}

export function simulate({ minutes = 90, seed = 1, crises = 'play', runs = 1, challenge = null, tier = 1, daily = null, play = 'active', onStep = null, chapter = 'earth' } = {}) {
  const bot = { hand: 0 };
  botSeed = seed;
  const s = newState(daily ? dailySeed(daily) : seed);
  if (challenge) s.run = { challenge, tier };
  if (daily) s.run = { daily };
  if (s.run) applyRunStart(s);
  // Capítulo direto (calibragem): a partida começa como depois da colonização.
  if (chapter !== 'earth') { s.chapter = chapter; P.startRun(s); }
  if (crises === 'off') s.events.next = Infinity;
  const marks = {};
  const ascensions = [];
  let runStart = 0;
  let saturated = 0;
  let runSat = 0;
  let runSteps = 0;
  for (let step = 0; step < minutes * 60 / DT; step++) {
    botStep(s, crises, play, bot);
    if (E.gridLoad(s) > 1) { saturated++; runSat++; }
    runSteps++;
    const min = (step * DT) / 60;
    onStep?.(s, min);
    for (const g of GENERATORS) if (s.owned[g.id] > 0 && !(g.id in marks)) marks[g.id] = min;
    if (s.labs > 0 && !('lab' in marks)) marks.lab = min;
    if (!('shop' in marks) && shopDone(s)) marks.shop = min;
    if (!('monument' in marks) && s.legacy.monument > 0) marks.monument = min;
    if (goalReached(s)) { s.run.done = true; marks.goal = min; break; }
    if (P.canAscend(s) && P.legacyGain(s) >= Math.max(1, s.legacy.earned / 2) && ascensions.length < runs) {
      const gain = P.ascend(s);
      ascensions.push({ at: min, took: min - runStart, gain, n: s.legacy.ascensions, sat: runSat / runSteps });
      runSat = 0;
      runSteps = 0;
      runStart = min;
      if (crises === 'off') s.events.next = Infinity;
      shop(s);
    }
  }
  return { s, marks, ascensions, saturated: saturated / (minutes * 60 / DT) };
}

const pad = (n) => String(n).padStart(2, '0');
// m:ss até 1 h; depois XhYY (min).
function clock(min) {
  const sec = Math.round(min * 60);
  if (sec < 3600) return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  return `${Math.floor(sec / 3600)}h${pad(Math.floor((sec % 3600) / 60))}`;
}

// Rodado direto (não importado): no Node 18 ainda não existe import.meta.main.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const minutes = Number(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 90);
  const seeds = Number(args.seeds ?? 5);
  const crises = args.crises ?? 'play';
  const runs = Number(args.runs ?? 1);
  const special = { challenge: args.challenge ?? null, tier: Number(args.tier ?? 1), daily: args.daily ?? null, play: args.play ?? 'active', chapter: args.chapter ?? 'earth' };
  const what = special.challenge ? ` · desafio ${special.challenge} ${special.tier}` : special.daily ? ` · semente ${special.daily}` : '';
  console.log(`Simulação: ${minutes} min, ${seeds} seeds, crises=${crises}, jogo ${special.play}, até ${runs} ascensão(ões)${what}\n`);
  for (let seed = 1; seed <= seeds; seed++) {
    const { s, marks, ascensions, saturated } = simulate({ minutes, seed, crises, runs, ...special });
    if (s.run) {
      const goal = `$${runGoal(s).toExponential(1)}`;
      console.log(`seed ${seed}: meta ${goal} ${'goal' in marks ? `em ${clock(marks.goal)}` : `não alcançada em ${minutes} min ($${s.earned.toExponential(2)})`}`);
      continue;
    }
    const order = ['solar', 'lab', 'hydro', 'gas', 'nuclear', 'tidal', 'fusion', 'antimatter', 'swarm', 'kugelblitz', 'vacuum'];
    const m = order.filter((k) => k in marks).map((k) => `${k} ${clock(marks[k])}`).join('  ');
    // Muitas ascensões: mostra as 8 primeiras e as 4 últimas.
    const list = ascensions.length > 12 ? [...ascensions.slice(0, 8), null, ...ascensions.slice(-4)] : ascensions;
    const asc = list.map((a) => (a ? `#${a.n} ${clock(a.at)} (+${a.gain})` : '…')).join('  ') || 'nenhuma';
    const short = ascensions.filter((a) => a.n > 3 && a.took < 10).length;
    const c = s.career.crises;
    console.log(`seed ${seed}: ${m}`);
    console.log(`        legado: ${asc}`);
    console.log(`        loja completa: ${'shop' in marks ? clock(marks.shop) : 'não'} · monumento nv ${s.legacy.monument}` +
      `${'monument' in marks ? ` (1º em ${clock(marks.monument)})` : ''} · partidas < 10 min após a 3ª: ${short}` +
      ` · conquistas ${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}`);
    console.log(`        crises: ${c.won} vencidas, ${c.lost} perdidas, ${c.timeout} ignoradas, $${s.career.crewPaid.toExponential(2)} pagos · ` +
      `pico ${s.career.peakKw.toExponential(2)} kW · rede saturada ${Math.round(saturated * 100)}% do tempo\n`);
  }
}
