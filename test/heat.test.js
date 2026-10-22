import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS } from '../src/data/generators.js';
import { HEAT, COOLING } from '../src/data/heat.js';
import { GRID } from '../src/data/grid.js';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { tick, genPower, genModMult, capacity, transformerCost, applyOffline } from '../src/core/engine.js';
import {
  heatTarget, heatStep, efficiency, isShutdown, heatLevel, heatFactor, nextCooling, HOT_GENERATORS,
} from '../src/core/heat.js';
import { buyCooling, buyTransformer } from '../src/core/actions.js';
import { createHistory, sampleHistory, HISTORY_LEN } from '../src/core/stats.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);
const outMult = (s) => (g) => genModMult(s, g, 'output');
const reactor = (id, n = 1) => {
  const s = newState();
  s.techs = { t_solar: 1, t_hydro: 1, t_gas: 1, t_nuclear: 1, t_fusion: 1, t_antimatter: 1 };
  s.owned[id] = n;
  return s;
};
// Roda `seconds` em passos de 0.1 s (como o jogo) e junta os desligamentos.
function run(s, seconds) {
  const shut = [];
  for (let i = 0; i < seconds * 10; i++) shut.push(...tick(s, 0.1));
  return shut;
}

test('reatores quentes: nuclear, fusão e antimatéria na Terra; Mercúrio e Star Lifting no Sistema Solar', () => {
  assert.deepEqual(HOT_GENERATORS.map((g) => g.id), ['nuclear', 'fusion', 'antimatter', 'mercury', 'starlift']);
});

test('alvo de calor: 0 sem unidades; base sem upgrades; sobe com produção; resfriamento divide', () => {
  const s = reactor('nuclear', 0);
  const n = gen('nuclear');
  assert.equal(heatTarget(s, n, 1), 0);
  s.owned.nuclear = 1;
  assert.equal(heatTarget(s, n, 1), 0.7);
  assert.ok(Math.abs(heatTarget(s, n, 4) - 0.7 * (1 + HEAT.intensity * 2)) < 1e-12);
  s.cooling.nuclear = 2;
  assert.ok(Math.abs(heatTarget(s, n, 4) - (0.7 * (1 + HEAT.intensity * 2)) / COOLING.factor ** 2) < 1e-12);
});

test('calor converge para o alvo com inércia', () => {
  const s = reactor('nuclear', 1);
  run(s, 5);
  const early = heatLevel(s, gen('nuclear'));
  assert.ok(early > 0.05 && early < 0.5, `cedo demais: ${early}`);
  run(s, 200);
  assert.ok(Math.abs(heatLevel(s, gen('nuclear')) - 0.7) < 0.01);
});

test('eficiência: 100% até 80%, cai linearmente até 50% no limite', () => {
  assert.equal(efficiency(0.5), 1);
  assert.equal(efficiency(HEAT.warnAt), 1);
  assert.ok(Math.abs(efficiency(0.9) - 0.75) < 1e-12);
  assert.equal(efficiency(1), 0.5);
  assert.equal(efficiency(5), 0.5);
});

test('antimatéria sem resfriamento superaquece: desliga, para de produzir, esfria e volta', () => {
  const s = reactor('antimatter', 1);
  const a = gen('antimatter');
  const shut = run(s, 120);
  assert.ok(shut.includes('antimatter'), 'deveria ter desligado');
  // Pega um desligamento desde o início: espera religar e desligar de novo.
  while (isShutdown(s, a)) tick(s, 0.1);
  while (!isShutdown(s, a)) tick(s, 0.1);
  assert.equal(genPower(s, a), 0);
  const hot = heatLevel(s, a);
  run(s, HEAT.shutdownSeconds - 0.5);
  assert.ok(isShutdown(s, a));
  assert.ok(heatLevel(s, a) < hot, 'desligado deveria esfriar');
  run(s, 1);
  assert.ok(!isShutdown(s, a));
  assert.ok(genPower(s, a) > 0);
});

test('desligamento é avisado uma vez por ocorrência', () => {
  const s = reactor('antimatter', 1);
  // 1º desligamento ~61 s (20·ln 21); depois ciclos de ~54 s (10 s desligado + reaquecer).
  const shut = run(s, 90);
  assert.equal(shut.filter((x) => x === 'antimatter').length, 1);
  assert.equal(run(s, 60).filter((x) => x === 'antimatter').length, 1);
});

test('resfriamento evita o desligamento da antimatéria', () => {
  const s = reactor('antimatter', 1);
  s.money = 1e15;
  assert.ok(buyCooling(s, 'antimatter'));
  assert.equal(s.cooling.antimatter, 1);
  assert.deepEqual(run(s, 300), []);
  assert.ok(heatLevel(s, gen('antimatter')) < HEAT.warnAt);
});

test('comprar resfriamento exige o reator e dinheiro; trilha tem fim', () => {
  const s = reactor('nuclear', 0);
  s.money = 1e30;
  assert.equal(buyCooling(s, 'nuclear'), false); // sem reator
  assert.equal(buyCooling(s, 'wind'), false);    // eólica não esquenta
  s.owned.nuclear = 1;
  const c = nextCooling(s, gen('nuclear'));
  assert.equal(c.cost, gen('nuclear').baseCost * COOLING.levels[0].costMult);
  for (let i = 0; i < COOLING.levels.length; i++) assert.ok(buyCooling(s, 'nuclear'));
  assert.equal(nextCooling(s, gen('nuclear')), null);
  assert.equal(buyCooling(s, 'nuclear'), false);
  const poor = reactor('nuclear', 1);
  assert.equal(buyCooling(poor, 'nuclear'), false);
});

test('offline não simula calor: sem desligamentos, eficiência do alvo (mínimo 50%)', () => {
  const s = reactor('antimatter', 1);
  const before = structuredClone(s.heat);
  const r = applyOffline(s, 3600);
  assert.deepEqual(s.heat, before);
  assert.ok(Math.abs(heatFactor(s, gen('antimatter'), 1, true) - 0.5) < 1e-6);
  assert.ok(r.energy > 0);
});

test('transformadores: capacidade multiplicada a cada um, custo crescente', () => {
  const { capacityMult: m, baseCost: b, growth: k } = GRID.transformer;
  const s = newState();
  assert.equal(transformerCost(s), b);
  assert.equal(buyTransformer(s), false);
  s.money = 1e9;
  assert.ok(buyTransformer(s));
  assert.ok(buyTransformer(s));
  assert.equal(s.transformers, 2);
  assert.ok(Math.abs(capacity(s) - capacity(newState()) * m ** 2) < 1e-9);
  assert.equal(s.money, 1e9 - b - b * k);
  assert.equal(transformerCost(s), b * k * k);
});

test('histórico: uma amostra por segundo de jogo, no máximo 60', () => {
  const s = newState();
  s.owned.wind = 5;
  const h = createHistory();
  assert.ok(sampleHistory(h, s));
  assert.equal(sampleHistory(h, s), false); // mesmo segundo
  for (let i = 0; i < 300; i++) { tick(s, 0.5); sampleHistory(h, s); }
  assert.equal(h.kw.length, HISTORY_LEN);
  assert.equal(h.income.length, HISTORY_LEN);
});

test('save v4 migra para v5 com reatores frios, sem resfriamento e sem transformadores', () => {
  const v4 = { saveVersion: 4, savedAt: 1, state: { ...newState() } };
  delete v4.state.heat; delete v4.state.cooling; delete v4.state.transformers;
  const env = migrate(v4);
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.deepEqual(s.heat.nuclear, { h: 0, off: 0 });
  assert.equal(s.cooling.antimatter, 0);
  assert.equal(s.transformers, 0);
  assert.ok(isValidState(s));
  assert.ok(!isValidState({ ...s, heat: { nuclear: { h: NaN, off: 0 } } }));
  assert.ok(!isValidState({ ...s, transformers: -1 }));
});
