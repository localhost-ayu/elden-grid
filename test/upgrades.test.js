import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, LAB } from '../src/data/generators.js';
import { MILESTONES, UPGRADE_TRACK, UPGRADE_NAMES, UPGRADE_OVERRIDES } from '../src/data/upgrades.js';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import {
  genCost, labCost, genBulk, labBulk, genAffordable, seriesCost, genPower, genEnv, upkeep,
  nextMilestone, nextUpgrade, upgradeTrack, genModMult,
} from '../src/core/engine.js';
import { buyGen, buyGenBulk, buyLabBulk, buyUpgrade } from '../src/core/actions.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);
const rich = (money = 1e30) => Object.assign(newState(), { money, totalEnergy: 1e9 });

test('dados: toda fonte tem 5 nomes de upgrade; overrides apontam para níveis válidos', () => {
  for (const g of GENERATORS) assert.equal(UPGRADE_NAMES[g.id]?.length, UPGRADE_TRACK.length, g.id);
  for (const [id, lv] of Object.entries(UPGRADE_OVERRIDES)) {
    assert.ok(gen(id), id);
    for (const i of Object.keys(lv)) assert.ok(Number(i) < UPGRADE_TRACK.length);
  }
});

test('lote x10 custa exatamente o mesmo que 10 compras unitárias', () => {
  const a = rich(1e6);
  const b = rich(1e6);
  const cost = genBulk(a, gen('wind'), 10).cost;
  assert.equal(buyGenBulk(a, 'wind', 10), 10);
  for (let i = 0; i < 10; i++) assert.ok(buyGen(b, 'wind'));
  assert.equal(a.money, b.money);
  assert.equal(1e6 - a.money, cost);
  assert.equal(cost, seriesCost(15, 1.15, 0, 10));
});

test('lote x10/x100 só compra se couber o lote inteiro', () => {
  const s = rich(0);
  s.money = seriesCost(15, 1.15, 0, 10) - 1;
  assert.equal(buyGenBulk(s, 'wind', 10), 0);
  assert.equal(s.owned.wind, 0);
  s.money += 1;
  assert.equal(buyGenBulk(s, 'wind', 10), 10);
  assert.equal(s.money, 0);
  assert.equal(buyGenBulk(s, 'wind', 100), 0);
});

test('MAX compra o máximo possível e mostra quantas cabem', () => {
  const s = rich(5000);
  const fits = genAffordable(s, gen('wind'));
  assert.ok(fits > 10);
  assert.equal(genBulk(s, gen('wind'), 'max').n, fits);
  assert.equal(buyGenBulk(s, 'wind', 'max'), fits);
  assert.ok(s.money < genCost(s, gen('wind'))); // não sobrou para mais uma
  const broke = rich(0);
  assert.equal(buyGenBulk(broke, 'wind', 'max'), 0);
  assert.equal(genBulk(broke, gen('wind'), 'max').cost, 15); // preço de 1, para a UI
});

test('laboratório também compra em lote', () => {
  const s = rich(1e6);
  assert.equal(buyLabBulk(s, 10), 10);
  assert.equal(s.labs, 10);
  assert.equal(labCost(s), Math.ceil(LAB.baseCost * LAB.growth ** 10));
  assert.ok(labBulk(s, 'max').n > 0);
});

test('marcos 25/50/100 dobram a produção por unidade, cumulativos', () => {
  const s = rich();
  const w = gen('wind');
  const perUnit = () => genPower(s, w) / s.owned.wind / genEnv(s, w);
  s.owned.wind = 24;
  assert.equal(perUnit(), 1);
  assert.deepEqual(nextMilestone(s, w), MILESTONES[0]);
  s.owned.wind = 25;
  assert.equal(perUnit(), 2);
  s.owned.wind = 100;
  assert.equal(perUnit(), 8);
  assert.equal(nextMilestone(s, w), null);
});

test('upgrade exige 1 unidade e dinheiro; sobe nível e aplica o efeito', () => {
  const s = rich(0);
  const w = gen('wind');
  assert.equal(buyUpgrade(s, 'wind'), false); // sem unidade
  s.owned.wind = 1;
  assert.equal(buyUpgrade(s, 'wind'), false); // sem dinheiro
  s.money = 150;
  assert.equal(nextUpgrade(s, w).cost, 150);
  assert.ok(buyUpgrade(s, 'wind'));
  assert.equal(s.upgrades.wind, 1);
  assert.equal(s.money, 0);
  assert.equal(genModMult(s, w, 'output'), 2);
});

test('upgrade de custo barateia as próximas unidades (e o lote)', () => {
  const s = rich();
  const w = gen('wind');
  s.owned.wind = 10;
  const before = genCost(s, w);
  s.upgrades.wind = 2; // nível 2 = custo x0.85
  assert.equal(genCost(s, w), Math.ceil(15 * 1.15 ** 10 * 0.85));
  assert.ok(genCost(s, w) < before);
  assert.equal(genBulk(s, w, 10).cost, seriesCost(15, 1.15, 10, 10, 0.85));
});

test('gás/fusão: nível 4 corta o custo de operação pela metade', () => {
  const s = rich();
  s.owned.gas = 4;
  assert.equal(upkeep(s), 480);
  s.upgrades.gas = 4;
  assert.equal(upkeep(s), 240);
  assert.match(upgradeTrack(gen('fusion'))[3].effects.map((e) => e.type).join(), /upkeep/);
});

test('trilha completa: 18x de produção e nada mais para comprar', () => {
  const s = rich();
  s.owned.solar = 1;
  s.techs.t_solar = true;
  for (let i = 0; i < 5; i++) assert.ok(buyUpgrade(s, 'solar'));
  assert.equal(buyUpgrade(s, 'solar'), false);
  assert.equal(nextUpgrade(s, gen('solar')), null);
  assert.equal(genModMult(s, gen('solar'), 'output'), 18);
});

test('upgrade de gerador bloqueado não é vendido', () => {
  const s = rich();
  s.owned.biomass = 1; // estado forjado: tem unidade mas não a pesquisa
  assert.equal(buyUpgrade(s, 'biomass'), false);
});

test('save v2 (sem upgrades) migra para v3 com todos os níveis em 0', () => {
  const v2 = { saveVersion: 2, savedAt: 1, state: { ...newState(), upgrades: undefined } };
  delete v2.state.upgrades;
  const env = migrate(v2);
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.equal(s.upgrades.wind, 0);
  assert.equal(s.upgrades.antimatter, 0);
  assert.ok(isValidState(s));
  assert.ok(!isValidState({ ...s, upgrades: { wind: -1 } }));
});
