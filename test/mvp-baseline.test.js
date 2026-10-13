// Testes de caracterização: congelam as regras básicas da economia (custos, produção,
// preço, manivela, pesquisa) para refatorações não mudarem o comportamento sem querer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, LAB } from '../src/data/generators.js';
import { TECHS } from '../src/data/research.js';
import { newState } from '../src/core/state.js';
import {
  tick, genCost, labCost, power, price, rpRate, labUnlocked, techVisible, genEnv,
} from '../src/core/engine.js';
import { crank, buyGen, buyLab, buyTech } from '../src/core/actions.js';
import { fmt } from '../src/ui/format.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);

test('estado inicial zerado, com todos os geradores em 0', () => {
  const s = newState();
  assert.equal(s.money, 0);
  assert.equal(s.labs, 0);
  assert.deepEqual(Object.keys(s.owned), GENERATORS.map((g) => g.id));
  assert.ok(Object.values(s.owned).every((n) => n === 0));
});

test('custo do gerador cresce baseCost * 1.15^qtd (arredondado para cima)', () => {
  const s = newState();
  assert.equal(genCost(s, gen('wind')), 15);
  s.owned.wind = 10;
  assert.equal(genCost(s, gen('wind')), Math.ceil(15 * 1.15 ** 10));
  s.labs = 3;
  assert.equal(labCost(s), Math.ceil(LAB.baseCost * LAB.growth ** 3));
});

test('comprar gerador desconta dinheiro e falha sem saldo', () => {
  const s = newState();
  assert.equal(buyGen(s, 'wind'), false);
  s.money = 20;
  assert.equal(buyGen(s, 'wind'), true);
  assert.equal(s.money, 5);
  assert.equal(s.owned.wind, 1);
});

test('gerador bloqueado por tech não pode ser comprado', () => {
  const s = newState();
  s.money = 1e9;
  assert.equal(buyGen(s, 'solar'), false);
  s.techs.t_solar = true;
  assert.equal(buyGen(s, 'solar'), true);
});

// A eólica varia com o vento, então a produção é comparada já multiplicada pelo fator
// de vento do instante (genEnv).
test('produção soma geradores e aplica multiplicadores de tech', () => {
  const s = newState();
  const wind = genEnv(s, gen('wind'));
  s.owned.wind = 4;
  assert.equal(power(s), 4 * wind);
  s.techs.t_wind2 = true; // eólica x2
  assert.equal(power(s), 8 * wind);
  s.techs.t_grid2 = true; // global x1.5
  assert.ok(Math.abs(power(s) - 12 * wind) < 1e-9);
});

test('preço oscila ±20% em torno de 1 e respeita tech de preço', () => {
  const s = newState();
  assert.equal(price(s), 1);
  for (let t = 0; t < 200; t += 0.7) {
    s.t = t;
    assert.ok(price(s) >= 0.8 - 1e-9 && price(s) <= 1.2 + 1e-9);
  }
  s.t = 0;
  s.techs.t_grid = true;
  assert.equal(price(s), 1.25);
});

test('tick vende a energia produzida e acumula PP', () => {
  const s = newState();
  s.owned.wind = 10;
  s.labs = 2;
  const kw = power(s);
  tick(s, 1);
  assert.equal(s.totalEnergy, kw);
  assert.ok(s.money > 0);
  assert.equal(s.rp, 2 * LAB.rpPerSec);
  assert.equal(rpRate(s), 0.5);
});

test('manivela rende no mínimo 1 kWh', () => {
  const s = newState();
  assert.equal(crank(s), 1);
  assert.equal(s.totalEnergy, 1);
  s.owned.wind = 10;
  assert.equal(crank(s), Math.max(1, power(s) * 0.5)); // 50% da produção de 1 s
});

test('laboratório aparece após 200 kWh', () => {
  const s = newState();
  s.money = 1e6;
  assert.equal(labUnlocked(s), false);
  assert.equal(buyLab(s), false);
  s.totalEnergy = LAB.unlockAt;
  assert.equal(buyLab(s), true);
});

test('pesquisa exige pré-requisitos e PP suficientes', () => {
  const s = newState();
  s.rp = 1e6;
  const hydro = TECHS.find((t) => t.id === 't_hydro');
  assert.equal(techVisible(hydro, s), false);
  assert.equal(buyTech(s, 't_hydro'), false); // requer t_solar
  assert.equal(buyTech(s, 't_solar'), true);
  assert.equal(buyTech(s, 't_hydro'), true);
  assert.equal(buyTech(s, 't_hydro'), false); // não compra duas vezes
});

test('fmt usa sufixos curtos', () => {
  assert.equal(fmt(5), '5.00');
  assert.equal(fmt(42), '42.0');
  assert.equal(fmt(1234), '1.23k');
  assert.equal(fmt(4_560_000), '4.56M');
  assert.equal(fmt(1e18), '1.00Qi');
  // notação científica depois de Qi e números negativos
  assert.equal(fmt(999e18), '999.00Qi');
  assert.equal(fmt(1.234e24), '1.23e24');
  assert.equal(fmt(-1500), '-1.50k');
});
