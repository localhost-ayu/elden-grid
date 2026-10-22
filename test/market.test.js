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
