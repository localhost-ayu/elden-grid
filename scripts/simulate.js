// Simulação de balanceamento: um bot joga usando só o core (sem terminal) e mede quando
// chega a cada marco. Serve para ajustar as curvas em src/data/ com números, não no olho.
//
//   bun scripts/simulate.js [minutos=90] [--seeds=5] [--crises=play|idle|off] [--runs=1]
//
// Bot: gira a manivela nos 5 primeiros minutos, pesquisa tudo que puder, compra a fonte
// com mais kW médio por $ (MAX), upgrades, laboratório, resfriamento e transformadores
// quando custam uma fração pequena do saldo. Ascende quando a prévia rende pelo menos
// metade dos pontos já recebidos (ascender a cada ponto novo seria pouco humano).
import { fileURLToPath } from 'node:url';
import { newState } from '../src/core/state.js';
import * as E from '../src/core/engine.js';
import * as A from '../src/core/actions.js';
import { autoStep } from '../src/core/automation.js';
import * as H from '../src/core/heat.js';
import * as I from '../src/core/incidents.js';
import * as P from '../src/core/prestige.js';
import { GENERATORS } from '../src/data/generators.js';
import { TECHS } from '../src/data/research.js';
import { SHOP } from '../src/data/legacy.js';

const DT = 0.1;

function shop(s) {
  // Gasta metade dos pontos (do mais barato para o mais caro) e guarda o resto como bônus.
  const keep = Math.floor(s.legacy.points / 2);
  for (;;) {
    const opts = SHOP.map((it) => ({ it, c: P.nextShopCost(s, it) }))
      .filter((o) => o.c != null && s.legacy.points - o.c >= keep)
      .sort((a, b) => a.c - b.c);
    if (!opts.length) return;
    P.buyShop(s, opts[0].it.id);
  }
}

function botStep(s, crises) {
  if (s.stats.playTime < 300 && Math.round(s.t / DT) % 3 === 0) A.crank(s);
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
    if (P.canAscend(s) && P.legacyGain(s) >= Math.max(1, s.legacy.earned / 2) && ascensions.length < runs) {
      const gain = P.ascend(s);
      ascensions.push({ at: min, took: min - runStart, gain });
      runStart = min;
      if (crises === 'off') s.events.next = Infinity;
      shop(s);
    }
  }
  return { s, marks, ascensions, saturated: saturated / (minutes * 60 / DT) };
}

const clock = (min) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;

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
    const asc = ascensions.map((a, i) => `#${i + 1} ${clock(a.at)} (+${a.gain})`).join('  ') || 'nenhuma';
    const c = s.career.crises;
    console.log(`seed ${seed}: ${m}`);
    console.log(`        legado: ${asc}`);
    console.log(`        crises: ${c.won} vencidas, ${c.timeout} ignoradas, $${s.career.crewPaid.toExponential(2)} pagos · ` +
      `pico ${s.career.peakKw.toExponential(2)} kW · rede saturada ${Math.round(saturated * 100)}% do tempo\n`);
  }
}
