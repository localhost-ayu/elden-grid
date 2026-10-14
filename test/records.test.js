import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { newStats, mergeStats, isValidStats } from '../src/core/records.js';
import { tick, applyOffline, power } from '../src/core/engine.js';
import { crank, buyGenBulk, buyTech, buyUpgrade, buyTransformer, buyLab } from '../src/core/actions.js';
import { autoStep } from '../src/core/automation.js';
import { beginCrisis, crisisInput, callCrew } from '../src/core/incidents.js';
import { ascend } from '../src/core/prestige.js';
import { SCHEDULE } from '../src/data/events.js';
import { LEGACY } from '../src/data/legacy.js';
import { createApp } from '../src/ui/app.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

test('tick registra tempo, energia, dinheiro, produção por fonte e recordes', () => {
  const s = newState();
  s.owned.wind = 10;
  s.owned.solar = 2;
  s.techs.t_solar = true;
  for (let i = 0; i < 100; i++) tick(s, 0.1);
  const st = s.stats;
  assert.ok(Math.abs(st.playTime - 10) < 1e-9);
  assert.ok(Math.abs(st.energy - s.totalEnergy) < 1e-6);
  assert.ok(Math.abs(st.produced.wind + st.produced.solar - st.energy) < 1e-6); // as partes somam o todo
  assert.ok(st.produced.solar > 0);
  assert.ok(Math.abs(st.moneyEarned - s.money) < 1e-6);
  assert.ok(st.peakKw >= power(s) * 0.5 && st.peakIncome > 0 && st.peakPrice > 0);
  assert.deepEqual(s.career.produced, st.produced); // carreira recebe tudo também
});

test('offline conta tempo offline, não tempo jogado', () => {
  const s = newState();
  s.owned.wind = 5;
  applyOffline(s, 600);
  assert.equal(s.stats.offlineTime, 600);
  assert.equal(s.stats.playTime, 0);
  assert.ok(s.stats.energy > 0);
});

test('ações: manivela, compras, lote, marcos, upgrade, pesquisa, lab e transformador', () => {
  const s = newState();
  s.money = 1e7;
  s.rp = 100;
  s.totalEnergy = 1000;
  crank(s);
  crank(s);
  assert.equal(s.stats.cranks, 2);
  assert.equal(s.stats.crankBurst, 2); // dois giros no mesmo segundo
  assert.ok(s.stats.crankMoney > 0);
  buyGenBulk(s, 'wind', 30); // cruza o marco de 25
  assert.equal(s.stats.bought.wind, 30);
  assert.equal(s.stats.bulkPurchases, 1);
  assert.equal(s.stats.milestones, 1);
  buyUpgrade(s, 'wind');
  buyTech(s, 't_wind2');
  buyLab(s);
  buyTransformer(s);
  const st = s.stats;
  assert.deepEqual([st.upgrades, st.techs, st.labsBought, st.transformers], [1, 1, 1, 1]);
  assert.equal(st.rpSpent, 3);
  assert.ok(st.moneySpent > 0);
});

test('auto-compra conta as unidades que comprou', () => {
  const s = newState();
  s.techs.t_auto = true;
  s.auto.buy = true;
  s.money = 1e4;
  autoStep(s, 3);
  assert.equal(s.stats.autoBought, 3);
});

test('crises: vitória registra tempo e sequência; derrota zera a sequência', () => {
  const crisis = (s) => {
    s.events.effects.push({ id: 'overload', until: null });
    s.events.crisis = { id: 'overload', deadline: s.t + SCHEDULE.crisisDeadline, game: null };
  };
  const s = newState();
  s.owned.wind = 10;
  s.money = 1000;
  for (let i = 0; i < 2; i++) {
    crisis(s);
    beginCrisis(s);
    s.events.crisis.game.time = 4.2 - i;
    for (const k of [...s.events.crisis.game.seq]) crisisInput(s, k);
  }
  assert.equal(s.stats.crises.won, 2);
  assert.equal(s.stats.bestStreak, 2);
  assert.ok(Math.abs(s.stats.bestWin.sequence - 3.2) < 1e-9);
  crisis(s);
  callCrew(s);
  assert.equal(s.stats.crises.crew, 1);
  assert.equal(s.stats.streak, 0);
  assert.equal(s.stats.bestStreak, 2);
  assert.ok(s.stats.crewPaid > 0);
});

test('ascender zera a partida e mantém a carreira, com recorde de partida mais rápida', () => {
  const s = newState();
  s.owned.wind = 5;
  for (let i = 0; i < 50; i++) tick(s, 0.1);
  s.earned = LEGACY.minRunEarned;
  const careerEnergy = s.career.energy;
  ascend(s);
  assert.equal(s.stats.playTime, 0);
  assert.equal(s.stats.energy, 0);
  assert.equal(s.career.energy, careerEnergy);
  assert.ok(Math.abs(s.career.fastestRun - 5) < 1e-9);
  assert.ok(s.career.bestGain >= 1);
  assert.ok(isValidState(s));
});

test('fichas: mescla com padrões, validação e migração v7 -> v8', () => {
  const merged = mergeStats(newStats(), { cranks: 5, bought: { wind: 3 } });
  assert.equal(merged.cranks, 5);
  assert.equal(merged.bought.wind, 3);
  assert.equal(merged.bought.solar, 0);
  assert.equal(isValidStats({ ...newStats(), cranks: -1 }), false);
  assert.equal(isValidStats({ ...newStats(), bestWin: { timing: NaN } }), false);
  const v7 = { saveVersion: 7, savedAt: 1, state: { ...newState(), totalEnergy: 500, earned: 80 } };
  v7.state.legacy = { ...v7.state.legacy, lifetime: 1000 };
  delete v7.state.stats;
  delete v7.state.career;
  const env = migrate(v7);
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.equal(s.stats.energy, 500);
  assert.equal(s.career.moneyEarned, 1080);
  assert.ok(isValidState(s));
});

test('aba Estatísticas: colunas, rolagem até o fim e cabe em 80×24', () => {
  const s = newState();
  s.owned.wind = 3;
  s.stats.bought.wind = 3;
  s.career.bought.wind = 3;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.key('e');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  assert.match(text(), /Esta partida +Todas/);
  assert.match(text(), /Tempo jogado/);
  assert.match(text(), /linhas 1–/);
  app.key('end');
  assert.match(text(), /Viagens de DeLorean/);
  app.key('home');
  assert.match(text(), /Tempo jogado/);
  for (let i = 0; i < 100; i++) {
    for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
    app.key('down');
  }
});
