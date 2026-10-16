// Simulação de balanceamento: um bot joga usando só o core (sem terminal) e mede quando
// chega a cada marco. Serve para ajustar as curvas em src/data/ com números, não no olho.
//
//   bun scripts/simulate.js [minutos=90] [--seeds=5] [--crises=play|idle|off] [--runs=1]
//
// Bot: gira a manivela nos 5 primeiros minutos, pesquisa tudo que puder, compra a fonte
// com mais kW médio por $ (MAX), upgrades, laboratório, resfriamento e transformadores
// quando custam uma fração pequena do saldo. Ascende quando a prévia rende pelo menos
// metade dos pontos já recebidos (ascender a cada ponto novo seria pouco humano).
// Na loja, gasta metade dos pontos e ergue o Monumento só quando ele rende mais que
// guardar os pontos que custa.
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

const DT = 0.1;

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

function botStep(s, crises) {
  // Com a manivela automática o bot para de girar: um humano também pararia.
  if (s.stats.playTime < 300 && !P.shopPerk(s, 'crank').autoCrank && Math.round(s.t / DT) % 3 === 0) A.crank(s);
  for (const t of TECHS) if (E.techVisible(t, s) && s.rp >= t.cost) A.buyTech(s, t.id);
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
    if (!E.genUnlocked(g, s)) continue;
    const v = (g.output * E.genModMult(s, g, 'output') * E.genEnv(s, g, true)) / E.genCost(s, g);
    if (v > bestV) { bestV = v; best = g; }
  }
  if (best) A.buyGenBulk(s, best.id, 'max');
  E.tick(s, DT);
  autoStep(s, DT);
  autoCrankStep(s, DT);
  checkAchievements(s);
  if (crises === 'off') return;
  I.eventsStep(s, DT);
  // "play" vence toda crise na hora; "idle" deixa a equipe resolver no prazo.
  if (crises === 'play' && s.events.crisis) {
    I.beginCrisis(s);
    s.events.crisis.game.status = 'won';
    I.eventsStep(s, 0);
  }
}

export function simulate({ minutes = 90, seed = 1, crises = 'play', runs = 1 } = {}) {
  const s = newState(seed);
  if (crises === 'off') s.events.next = Infinity;
  const marks = {};
  const ascensions = [];
  let runStart = 0;
  let saturated = 0;
  for (let step = 0; step < minutes * 60 / DT; step++) {
    botStep(s, crises);
    if (E.gridLoad(s) > 1) saturated++;
    const min = (step * DT) / 60;
    for (const g of GENERATORS) if (s.owned[g.id] > 0 && !(g.id in marks)) marks[g.id] = min;
    if (s.labs > 0 && !('lab' in marks)) marks.lab = min;
    if (!('shop' in marks) && shopDone(s)) marks.shop = min;
    if (!('monument' in marks) && s.legacy.monument > 0) marks.monument = min;
    if (P.canAscend(s) && P.legacyGain(s) >= Math.max(1, s.legacy.earned / 2) && ascensions.length < runs) {
      const gain = P.ascend(s);
      ascensions.push({ at: min, took: min - runStart, gain, n: s.legacy.ascensions });
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
  console.log(`Simulação: ${minutes} min, ${seeds} seeds, crises=${crises}, até ${runs} ascensão(ões)\n`);
  for (let seed = 1; seed <= seeds; seed++) {
    const { s, marks, ascensions, saturated } = simulate({ minutes, seed, crises, runs });
    const order = ['solar', 'lab', 'hydro', 'gas', 'nuclear', 'tidal', 'fusion', 'antimatter'];
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
    console.log(`        crises: ${c.won} vencidas, ${c.timeout} ignoradas, $${s.career.crewPaid.toExponential(2)} pagos · ` +
      `pico ${s.career.peakKw.toExponential(2)} kW · rede saturada ${Math.round(saturated * 100)}% do tempo\n`);
  }
}
