// Recompensas dos desafios: valem nos slots 1–3, nunca dentro de um desafio.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES, TIER_MULT } from '../src/data/challenges.js';
import { SCHEDULE } from '../src/data/events.js';
import { useProfile, rewardMult, reward, totalTiers } from '../src/core/rewards.js';
import { newProfile, completeChallenge } from '../src/core/profile.js';
import { power, capacity, priceBase, upkeep, genModMult } from '../src/core/engine.js';
import { eventsStep } from '../src/core/incidents.js';
import { ascend } from '../src/core/prestige.js';
import { LEGACY } from '../src/data/legacy.js';
import { GENERATORS } from '../src/data/generators.js';
import { newState } from '../src/core/state.js';

afterEach(() => useProfile(null)); // o perfil ativo é global no core: cada teste limpa

const profileWith = (tiers) => {
  const p = newProfile();
  for (const [id, n] of Object.entries(tiers)) for (let t = 1; t <= n; t++) completeChallenge(p, id, t, 100);
  return p;
};

test('sem perfil (ou perfil vazio), tudo neutro', () => {
  const s = newState();
  assert.equal(rewardMult(s), 1);
  for (const c of CHALLENGES) assert.equal(reward(s, c.reward.type), 0);
});

test('cada nível completo multiplica a produção por TIER_MULT; com tudo, x10.8', () => {
  const s = newState();
  s.owned.wind = 10;
  const base = power(s);
  useProfile(profileWith({ blackout: 2, fuel: 1 }));
  assert.equal(totalTiers(), 3);
  assert.ok(Math.abs(power(s) / base - TIER_MULT ** 3) < 1e-9);
  useProfile(profileWith(Object.fromEntries(CHALLENGES.map((c) => [c.id, 5]))));
  assert.ok(Math.abs(rewardMult(s) - TIER_MULT ** 25) < 1e-9);
  assert.ok(rewardMult(s) > 10.8);
});

test('vantagens temáticas: prazo das crises, solar, rede, preço e operação', () => {
  const s = newState();
  const before = { cap: capacity(s), price: priceBase(s) };
  s.owned.gas = 3;
  const up = upkeep(s);
  useProfile(profileWith({ blackout: 2, calm: 3, oldgrid: 4, crash: 5, fuel: 5 }));
  assert.equal(reward(s, 'crisisTime'), 30);
  assert.ok(Math.abs(genModMult(s, GENERATORS.find((g) => g.id === 'solar'), 'output') - 1.6) < 1e-9);
  assert.ok(Math.abs(capacity(s) / before.cap - TIER_MULT ** 19 * 2) < 1e-6);
  assert.ok(Math.abs(priceBase(s) / before.price - 1.25) < 1e-9);
  assert.ok(Math.abs(upkeep(s) / up - 0.5) < 1e-9);

  // Crise nova ganha o prazo extra.
  s.owned.wind = 10;
  s.events.next = 0;
  for (let i = 0; i < 50 && !s.events.crisis; i++) {
    eventsStep(s, 0);
    if (!s.events.crisis) { s.events.effects = []; s.events.next = 0; }
  }
  assert.ok(s.events.crisis);
  assert.equal(s.events.crisis.deadline, s.t + SCHEDULE.crisisDeadline + 30);
});

test('dentro de um desafio nada disso vale', () => {
  useProfile(profileWith({ blackout: 5, calm: 5 }));
  const s = newState();
  s.run = { challenge: 'oldgrid', tier: 1 };
  assert.equal(rewardMult(s), 1);
  assert.equal(reward(s, 'solar'), 0);
});

test('Brisa Solar: a solar já vem pesquisada ao ascender', () => {
  useProfile(profileWith({ calm: 1 }));
  const s = newState();
  s.earned = LEGACY.minRunEarned;
  s.owned.antimatter = 1;
  ascend(s);
  assert.equal(s.techs.t_solar, true);
});
