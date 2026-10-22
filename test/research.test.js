import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS } from '../src/data/regions.js';
import { TECHS } from '../src/data/research.js';
import { GRID } from '../src/data/grid.js';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { capacity, sales, price, power, income, upkeep, tick, gridLoad } from '../src/core/engine.js';
import { buyTech, buyGen } from '../src/core/actions.js';
import { autoInterval, autoStep, toggleAuto, cheapestGen } from '../src/core/automation.js';
import { flattenTree } from '../src/ui/screens/research.js';

const withTechs = (...ids) => Object.assign(newState(), { techs: Object.fromEntries(ids.map((i) => [i, true])) });

test('árvore: toda tech aparece uma vez, sempre depois do pai, com conectores', () => {
  const tree = flattenTree();
  assert.equal(tree.length, TECHS.length);
  assert.equal(new Set(tree.map((n) => n.tech.id)).size, TECHS.length);
  const pos = new Map(tree.map((n, i) => [n.tech.id, i]));
  for (const t of TECHS) if (t.req[0]) assert.ok(pos.get(t.req[0]) < pos.get(t.id), `${t.id} antes do pai`);
  for (const n of tree) assert.match(n.prefix, /(├─|└─) $/);
  // a última raiz fecha com └─ e o último filho de cada pai também
  assert.match(tree.at(-1).prefix, /└─ $/);
});

test('árvore de exemplo: prefixos com │ só onde ainda há irmãos abaixo', () => {
  const t = (id, req = []) => ({ id, req });
  const tree = flattenTree([t('a'), t('a1', ['a']), t('a2', ['a']), t('a2x', ['a2']), t('b')]);
  assert.deepEqual(tree.map((n) => n.prefix + n.tech.id), [
    '├─ a', '│ ├─ a1', '│ └─ a2', '│   └─ a2x', '└─ b',
  ]);
});

test('não compra pesquisa bloqueada, nem com PP de sobra; pré-requisito extra também conta', () => {
  const s = withTechs('t_grid', 't_hv', 't_substation');
  s.rp = 1e9;
  assert.equal(buyTech(s, 't_market'), false); // requer t_grid E t_hvdc
  assert.equal(buyTech(s, 't_continental'), false);
  assert.ok(buyTech(s, 't_hvdc'));
  assert.ok(buyTech(s, 't_market'));
});

test('capacidade da rede: base da região e multiplicadores das pesquisas', () => {
  const base = REGIONS.earth[0].base;
  assert.equal(capacity(newState()), base);
  const mult = (id) => TECHS.find((t) => t.id === id).mult;
  assert.ok(Math.abs(capacity(withTechs('t_hv')) - base * mult('t_hv')) < 1e-9);
  assert.ok(Math.abs(capacity(withTechs('t_hv', 't_substation')) - base * mult('t_hv') * mult('t_substation')) < 1e-9);
});

test('venda: até a capacidade a preço cheio, excedente com desconto', () => {
  const s = newState();
  const p = price(s);
  const cap = capacity(s);
  assert.deepEqual(sales(s, 100), { full: 100, excess: 0, perSecond: 100 * p });
  const over = sales(s, cap + 100);
  assert.equal(over.full, cap);
  assert.equal(over.excess, 100);
  assert.ok(Math.abs(over.perSecond - (cap + 100 * GRID.excessPriceRate) * p) < 1e-9);
});

test('tick e renda respeitam a capacidade (energia total conta tudo)', () => {
  const s = newState();
  s.owned.nuclear = 1; // 6000 kW numa rede de 1000 (Bairro)
  s.techs.t_nuclear = true;
  assert.ok(gridLoad(s) > 1);
  const kw = power(s);
  const expected = sales(s, kw).perSecond - upkeep(s);
  assert.ok(Math.abs(income(s) - expected) < 1e-9);
  tick(s, 1);
  assert.equal(s.totalEnergy, kw);
  assert.ok(Math.abs(s.money - expected) < 1e-6);
  assert.ok(expected < kw * price(newState())); // vendeu menos do que sem gargalo
});

test('automação: sem pesquisa não faz nada; pesquisar liga e compra o mais barato', () => {
  const s = newState();
  s.money = 1e6;
  assert.equal(autoInterval(s), null);
  assert.equal(autoStep(s, 10), 0);
  assert.equal(toggleAuto(s), false);
  s.techs.t_lab = true;
  s.rp = 1e6;
  assert.ok(buyTech(s, 't_auto'));
  assert.equal(s.auto.buy, true);
  assert.equal(autoInterval(s), 1);
  assert.equal(cheapestGen(s).id, 'wind');
  assert.equal(autoStep(s, 0.5), 0);
  assert.equal(autoStep(s, 0.5), 1); // completou 1 s
  assert.equal(s.owned.wind, 1);
  assert.equal(autoStep(s, 3), 3);
});

test('automação: desligada não compra; sem dinheiro espera; IA é mais rápida; rajada limitada', () => {
  const s = withTechs('t_lab', 't_auto');
  s.auto.buy = true;
  s.money = 0;
  assert.equal(autoStep(s, 5), 0);
  assert.equal(s.auto.clock, 0); // não acumula "créditos" enquanto está sem saldo
  s.money = 1e9;
  assert.ok(toggleAuto(s));
  assert.equal(autoStep(s, 5), 0);
  toggleAuto(s);
  s.techs.t_auto2 = true;
  assert.equal(autoInterval(s), 0.2);
  assert.equal(autoStep(s, 1), 5);
  assert.equal(autoStep(s, 1000), 50); // quadro atrasado não vira rajada infinita
  assert.equal(s.auto.clock, 0);
});

test('automação compra sempre a fonte mais barata do momento', () => {
  const s = withTechs('t_lab', 't_auto', 't_solar');
  s.auto.buy = true;
  s.money = 1e9;
  s.owned.wind = 30; // eólica já ficou mais cara que o 1º painel
  assert.equal(cheapestGen(s).id, 'solar');
  autoStep(s, 1);
  assert.equal(s.owned.solar, 1);
  assert.ok(buyGen(s, 'wind'));
});

test('save v3 migra para v4 com auto-compra desligada', () => {
  const v3 = { saveVersion: 3, savedAt: 1, state: { ...newState() } };
  delete v3.state.auto;
  const env = migrate(v3);
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.deepEqual(s.auto, { buy: false, clock: 0, crank: 0 });
  assert.ok(isValidState(s));
  assert.ok(!isValidState({ ...s, auto: { buy: 'sim', clock: 0 } }));
});
