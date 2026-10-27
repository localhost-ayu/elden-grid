import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { MARKET } from '../src/data/market.js';
import { marketFactor, marketStep, surging, addImpact } from '../src/core/market.js';
import { price, tick } from '../src/core/engine.js';

test('mercado: demanda passeia na faixa, surtos acontecem e a sorte é do mercado', () => {
  const s = newState(7);
  const rng = s.events.rng;
  let min = Infinity;
  let max = 0;
  let surges = 0;
  for (let i = 0; i < 36000; i++) {
    if (marketStep(s, 0.1) === 'surge') surges++;
    s.t += 0.1;
    min = Math.min(min, s.market.demand);
    max = Math.max(max, s.market.demand);
  }
  assert.ok(min >= MARKET.demand.min - 1e-9 && max <= MARKET.demand.max + 1e-9, `${min}–${max}`);
  assert.ok(max - min > 0.2, 'a demanda anda de verdade');
  assert.ok(surges > 5, `${surges} surtos em 1 h`);
  assert.equal(s.events.rng, rng, 'não mexe na sorte dos eventos');
  const again = newState(7);
  for (let i = 0; i < 36000; i++) { marketStep(again, 0.1); again.t += 0.1; }
  assert.deepEqual(again.market, s.market, 'mesma seed, mesmo mercado');
});

test('mercado: surto multiplica o preço; vender derruba e o impacto cai à metade no tempo', () => {
  const s = newState();
  const base = price(s);
  s.market.surgeUntil = s.t + 10;
  assert.ok(surging(s));
  assert.ok(Math.abs(price(s) / base - MARKET.surge.mult) < 1e-9);
  s.market.surgeUntil = 0;
  addImpact(s, 100, 100); // vendeu a profundidade inteira: preço à metade
  assert.ok(Math.abs(price(s) / base - 0.5) < 1e-9);
  s.market.retarget = Infinity; // só o impacto mudando
  marketStep(s, MARKET.impact.halfLife);
  assert.ok(Math.abs(s.market.impact - 0.5) < 1e-9);
  assert.equal(marketFactor(s, true), 1, 'offline o mercado é neutro');
});

test('tick avança o mercado só online; save v11 migra para v12 com o mercado', () => {
  const s = newState();
  s.owned.wind = 5;
  const before = JSON.stringify(s.market);
  tick(s, 3600, true);
  assert.equal(JSON.stringify(s.market), before, 'offline não sorteia nada');
  for (let i = 0; i < 400; i++) tick(s, 0.1);
  assert.notEqual(JSON.stringify(s.market), before);
  const old = JSON.parse(JSON.stringify(newState()));
  delete old.market;
  const env = migrate({ saveVersion: 11, savedAt: 1, state: old });
  assert.equal(env.saveVersion, SAVE_VERSION);
  const back = fromSave(env.state);
  assert.ok(isValidState(back));
  assert.equal(back.market.demand, 1);
  assert.equal(isValidState({ ...back, market: { ...back.market, impact: NaN } }), false);
});

test('baterias: carregam com o excedente, a carga barata desvia produção e vender derruba o preço', async () => {
  const { capacity, power, sellBattery, batteryValue } = await import('../src/core/engine.js');
  const { buyBank } = await import('../src/core/actions.js');
  const { BATTERY } = await import('../src/data/market.js');
  const { batteryCap } = await import('../src/core/market.js');
  const s = newState();
  s.owned.wind = 400; // acima da capacidade da rede do Bairro, sem pesquisas
  s.market.retarget = Infinity;
  tick(s, 1);
  assert.equal(s.market.battery.kwh, 0, 'sem banco não guarda nada');
  s.money = 1e6;
  assert.ok(buyBank(s));
  assert.equal(s.market.battery.banks, 1);
  const excess = power(s) - capacity(s);
  assert.ok(excess > 0);
  tick(s, 1);
  assert.ok(Math.abs(s.market.battery.kwh - excess) / excess < 0.05, 'guarda o excedente');
  for (let i = 0; i < 200; i++) tick(s, 1);
  assert.ok(Math.abs(s.market.battery.kwh - batteryCap(s, capacity(s))) < 1e-6, 'para no limite');
  // Venda: o valor sofre o próprio impacto, e o preço cai depois.
  const kwh = s.market.battery.kwh;
  const naive = kwh * price(s) * BATTERY.manualRate;
  const expected = batteryValue(s, kwh, BATTERY.manualRate);
  assert.ok(expected < naive);
  const before = price(s);
  const money = s.money;
  assert.ok(Math.abs(sellBattery(s) - expected) < 1e-6);
  assert.ok(Math.abs(s.money - money - expected) < 1e-6);
  assert.equal(s.market.battery.kwh, 0);
  assert.ok(price(s) < before, 'vender derruba o preço');
  // Carga barata: com o preço abaixo da média, guarda parte da produção mesmo sem excesso.
  const calm = newState();
  calm.owned.wind = 1;
  calm.money = 1e6;
  buyBank(calm);
  calm.market.battery.cheap = true;
  calm.market.retarget = Infinity;
  calm.t = 15 * Math.PI * 1.5; // vale da senoide: preço abaixo da média
  tick(calm, 1);
  assert.ok(calm.market.battery.kwh > 0);
  // Offline não carrega.
  const off = newState();
  off.owned.wind = 400;
  off.money = 1e6;
  buyBank(off);
  tick(off, 3600, true);
  assert.equal(off.market.battery.kwh, 0);
});

test('baterias: venda automática só no surto ou no preço alto, a valor menor', () => {
  const s = newState();
  s.market.battery = { kwh: 1000, banks: 1, cheap: false, auto: true };
  s.market.retarget = Infinity;
  s.t = 15 * Math.PI * 1.5; // preço baixo
  tick(s, 1);
  assert.equal(s.market.battery.kwh, 1000);
  s.market.surgeUntil = s.t + 10;
  tick(s, 1);
  assert.ok(s.market.battery.kwh < 1000);
  assert.ok(s.stats.batteryMoney > 0);
});

test('aba Mercado: B compra banco, V vende, A e C alternam; cabe em 80×24', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi, visibleLength } = await import('../src/ui/format.js');
  const s = newState();
  s.events.next = 1e9;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.key('k');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  app.key('v');
  assert.match(text(), /Compre um banco de baterias primeiro/);
  app.key('b');
  assert.match(text(), /Faltam \$/);
  s.money = 1e9;
  app.key('b');
  assert.equal(s.market.battery.banks, 1);
  s.market.battery.kwh = 500;
  app.key('a');
  app.key('c');
  assert.equal(s.market.battery.auto, true);
  assert.equal(s.market.battery.cheap, true);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  app.key('v');
  assert.match(text(), /Vendeu 500(\.0+)? kWh por \$/);
  assert.equal(s.market.battery.kwh, 0);
});
