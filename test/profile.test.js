// Perfil compartilhado e save v10. Disco só numa pasta temporária.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newProfile, fromProfile, completeChallenge, challengeTier, recordDaily, MAX_TIER } from '../src/core/profile.js';
import { readProfile, writeProfile, profilePath } from '../src/storage/profile.js';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elden-grid-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('níveis de desafio sobem um de cada vez e guardam o melhor tempo de cada nível', () => {
  const p = newProfile();
  assert.equal(completeChallenge(p, 'blackout', 2, 900), false); // pulou o nível 1
  assert.equal(challengeTier(p, 'blackout'), 0);
  assert.equal(completeChallenge(p, 'blackout', 1, 1200), true);
  assert.equal(completeChallenge(p, 'blackout', 1, 1500), false); // repetir não sobe
  assert.equal(p.challenges.blackout.best[1], 1200);
  assert.equal(completeChallenge(p, 'blackout', 1, 1000), false);
  assert.equal(p.challenges.blackout.best[1], 1000); // mas melhora o recorde
  for (let t = 2; t <= MAX_TIER; t++) assert.equal(completeChallenge(p, 'blackout', t, 2000), true);
  assert.equal(challengeTier(p, 'blackout'), MAX_TIER);
  assert.equal(completeChallenge(p, 'blackout', MAX_TIER + 1, 10), false);
});

test('semente do dia: só o melhor tempo de cada data', () => {
  const p = newProfile();
  assert.equal(recordDaily(p, '2026-10-16', 2400), true);
  assert.equal(recordDaily(p, '2026-10-16', 2500), false);
  assert.equal(recordDaily(p, '2026-10-16', 2000), true);
  assert.equal(p.daily['2026-10-16'], 2000);
});

test('fromProfile aproveita o que é válido e descarta o resto', () => {
  const p = fromProfile({
    challenges: { ok: { tier: 2, best: { 1: 100, 2: 200, 9: 5, 3: -1 } }, bad: { tier: 7 }, worse: null },
    daily: { '2026-10-16': 300, ontem: 10, '2026-10-15': 'x' },
    extra: 'campo de versão futura',
  });
  assert.deepEqual(p.challenges, { ok: { tier: 2, best: { 1: 100, 2: 200 } } });
  assert.deepEqual(p.daily, { '2026-10-16': 300 });
  assert.deepEqual(fromProfile('lixo'), newProfile());
});

test('disco: sem arquivo = perfil novo; grava atômico; corrompido volta do .bak', () => {
  assert.deepEqual(readProfile(dir), newProfile());
  const p = newProfile();
  completeChallenge(p, 'blackout', 1, 600);
  assert.equal(writeProfile(p, dir), true);
  assert.deepEqual(readProfile(dir), p);
  completeChallenge(p, 'blackout', 2, 700);
  writeProfile(p, dir); // o anterior vira .bak
  fs.writeFileSync(profilePath(dir), '{ quebrado');
  assert.equal(challengeTier(readProfile(dir), 'blackout'), 1);
  fs.writeFileSync(profilePath(dir) + '.bak', 'também quebrado');
  assert.deepEqual(readProfile(dir), newProfile());
  fs.writeFileSync(path.join(dir, 'arquivo.txt'), '');
  assert.equal(writeProfile(p, path.join(dir, 'arquivo.txt')), false); // pasta impossível: false, sem lançar
});

test('save v9 migra para v10 com run nulo; run de desafio ou do dia é validado', () => {
  const { run, ...old } = newState();
  const env = migrate({ saveVersion: 9, savedAt: 1, state: old });
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.equal(s.run, null);
  assert.ok(isValidState(s));
  for (const ok of [{ challenge: 'blackout', tier: 1 }, { challenge: 'x', tier: 5 }, { daily: '2026-10-16' }]) {
    assert.ok(isValidState({ ...s, run: ok }), JSON.stringify(ok));
  }
  for (const bad of [{ challenge: 'x', tier: 0 }, { challenge: 'x', tier: 6 }, { daily: 'hoje' }, {}, 'x']) {
    assert.ok(!isValidState({ ...s, run: bad }), JSON.stringify(bad));
  }
});
