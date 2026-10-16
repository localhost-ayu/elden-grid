// Conquistas: dados consistentes, condições avaliadas pelo core, bônus no engine,
// sobrevivência à ascensão e migração do save v8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS, CATEGORIES } from '../src/data/achievements.js';
import { GENERATORS } from '../src/data/generators.js';
import { TECHS } from '../src/data/research.js';
import { checkAchievements, achievementProgress, achievementCount, hasAchievement } from '../src/core/achievements.js';
import { power, achievementMult } from '../src/core/engine.js';
import { ascend } from '../src/core/prestige.js';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';

const byId = (id) => ACHIEVEMENTS.find((a) => a.id === id);

test('dados: ids únicos, categorias e referências válidas, textos cabem na tela', () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  assert.ok(ACHIEVEMENTS.length >= 60);
  const cats = new Set(CATEGORIES.map((c) => c.id));
  const gens = new Set(['any', ...GENERATORS.map((g) => g.id)]);
  const s = newState();
  for (const a of ACHIEVEMENTS) {
    assert.ok(cats.has(a.cat), a.id);
    assert.ok([...a.name].length <= 25, `${a.id}: nome longo`);
    assert.ok([...a.desc].length <= 36, `${a.id}: descrição longa`);
    if (a.gen) assert.ok(gens.has(a.gen), a.id);
    if (a.tech) assert.ok(TECHS.some((t) => t.id === a.tech), a.id);
    const p = achievementProgress(s, a); // todo tipo tem intérprete
    assert.ok(p >= 0 && p <= 1, a.id);
  }
  for (const c of CATEGORIES) assert.ok(ACHIEVEMENTS.some((a) => a.cat === c.id), c.id);
});

test('partida nova não ganha nada; cumprir a condição desbloqueia uma vez só', () => {
  const s = newState();
  assert.deepEqual(checkAchievements(s), []);
  s.career.energy = 1500;
  s.career.playTime = 42;
  const got = checkAchievements(s);
  assert.deepEqual(got.map((a) => a.id), ['a_mwh']);
  assert.equal(s.achievements.a_mwh, 42);
  assert.deepEqual(checkAchievements(s), []);
});

test('condições: posse, pesquisa, tempos (menor é melhor) e "sem X"', () => {
  const s = newState();
  for (const g of GENERATORS) s.owned[g.id] = 1;
  s.techs.t_auto2 = true;
  s.career.bestWin.mash = 1.5;
  s.career.fastestRun = 2000;
  s.stats.moneyEarned = 2e6; // sem laboratório, com manivela (cranks = 0 também conta)
  s.stats.cranks = 3;
  const got = checkAchievements(s).map((a) => a.id);
  for (const id of ['a_fusion', 'a_anti', 'a_all1', 'a_auto2', 'a_mash', 'a_nolab']) assert.ok(got.includes(id), id);
  for (const id of ['a_all25', 'a_fast30', 'a_nocrank', 'a_timing']) assert.ok(!got.includes(id), id);
  assert.ok(Math.abs(achievementProgress(s, byId('a_fast30')) - 0.9) < 1e-9);
});

test('Colecionador sai na mesma checagem que a 50ª conquista', () => {
  const s = newState();
  ACHIEVEMENTS.filter((a) => !['a_count50', 'a_mwh'].includes(a.id)).slice(0, 49).forEach((a) => { s.achievements[a.id] = 0; });
  s.career.energy = 1e3; // a 50ª
  const got = checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('a_mwh'));
  assert.ok(got.includes('a_count50'));
});

test('cada conquista soma ACHIEVEMENT_BONUS à produção', () => {
  const s = newState();
  s.owned.wind = 10;
  const base = power(s);
  s.achievements = { a_mwh: 0, a_gwh: 0, a_twh: 0 };
  assert.equal(achievementMult(s), 1 + 3 * ACHIEVEMENT_BONUS);
  assert.ok(Math.abs(power(s) - base * (1 + 3 * ACHIEVEMENT_BONUS)) < 1e-9);
  assert.equal(achievementCount(s), 3);
});

test('conquistas sobrevivem à ascensão', () => {
  const s = newState();
  s.earned = 3e10;
  s.owned.antimatter = 1;
  s.achievements = { a_mwh: 10 };
  assert.ok(ascend(s) > 0);
  assert.ok(hasAchievement(s, 'a_mwh'));
});

test('save v8 migra para v9 com conquistas vazias; valores inválidos são recusados', () => {
  const { achievements, ...old } = newState();
  const env = migrate({ saveVersion: 8, savedAt: 1, state: old });
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.deepEqual(s.achievements, {});
  assert.ok(isValidState(s));
  s.achievements.a_mwh = NaN;
  assert.ok(!isValidState(s));
});

test('UI: aviso ao conquistar (agrupado se forem muitas) e V alterna para a lista', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi } = await import('../src/ui/format.js');
  const open = (state) => {
    const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, status: n === 1 ? 'ok' : 'empty', savedAt: null, state })), load: () => ({ status: 'ok', savedAt: null, state }), save: () => true, remove() {} };
    const app = createApp({ store, now: 0 });
    app.key('1');
    return { app, text: () => app.lines(80, 24).map(stripAnsi).join('\n') };
  };
  const one = newState();
  one.career.energy = 2000;
  const a = open(one);
  a.app.update(0.1, 100);
  assert.match(a.text(), /★ Conquista: Primeira Faísca — produza 1 MWh/);
  a.app.key('e');
  a.app.key('v');
  assert.match(a.text(), /Conquistas {2}1\/\d+ {2}· {2}produção \+1%/);
  assert.match(a.text(), /\?\?\?|★ Primeira Faísca/);
  a.app.key('v');
  assert.match(a.text(), /Esta partida/);

  const many = newState();
  Object.assign(many.career, { energy: 2e6, moneyEarned: 2e9, cranks: 200 });
  const b = open(many);
  b.app.update(0.1, 100);
  assert.match(b.text(), /★ \d+ conquistas desbloqueadas!/);
});

test('conquistas de desafio olham o perfil compartilhado e saem no save aberto', async () => {
  const { useProfile } = await import('../src/core/rewards.js');
  const { newProfile, completeChallenge, recordDaily } = await import('../src/core/profile.js');
  const { CHALLENGES } = await import('../src/data/challenges.js');
  for (const a of ACHIEVEMENTS.filter((x) => x.type === 'challenge')) assert.ok(CHALLENGES.some((c) => c.id === a.challenge), a.id);
  const p = newProfile();
  useProfile(p);
  try {
    const s = newState();
    assert.deepEqual(checkAchievements(s).filter((a) => a.cat === 'challenges'), []);
    for (const c of CHALLENGES) completeChallenge(p, c.id, 1, 2000);
    for (let t = 2; t <= 5; t++) completeChallenge(p, 'fuel', t, 2000);
    recordDaily(p, '2026-10-16', 1700);
    const got = checkAchievements(s).map((a) => a.id);
    for (const id of ['c_tiers1', 'c_all1', 'c_fuel', 'c_daily1', 'c_dfast30']) assert.ok(got.includes(id), id);
    for (const id of ['c_tiers10', 'c_all3', 'c_calm', 'c_daily7', 'c_dfast20']) assert.ok(!got.includes(id), id);
    assert.ok(Math.abs(achievementProgress(s, byId('c_tiers10')) - 0.9) < 1e-9);
  } finally {
    useProfile(null);
  }
});
