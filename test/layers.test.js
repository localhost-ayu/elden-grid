// "Cerca" que falha se data/ ou core/ passarem a tocar terminal ou disco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState, fromSave } from '../src/core/state.js';
import { applyOffline, power, income, price } from '../src/core/engine.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

test('data/ e core/ não importam fs/os/readline nem usam process.stdout/ANSI', () => {
  const forbidden = [/node:fs|['"]fs['"]/, /node:os|['"]os['"]/, /readline/, /process\.std(out|in)/, /\\x1b/];
  for (const dir of ['data', 'core']) {
    for (const f of fs.readdirSync(path.join(SRC, dir))) {
      const code = fs.readFileSync(path.join(SRC, dir, f), 'utf8');
      for (const re of forbidden) assert.ok(!re.test(code), `${dir}/${f} viola a regra: ${re}`);
    }
  }
});

test('fromSave preenche geradores que não existiam no save', () => {
  const s = fromSave({ money: 5, owned: { wind: 3 } });
  assert.equal(s.owned.wind, 3);
  assert.equal(s.owned.fusion, 0);
  assert.deepEqual(s.techs, {});
});

test('offline: ignora ausências curtas, limita a 1h, roda a 50% e resume os ganhos', () => {
  const s = newState();
  s.owned.wind = 10;
  s.labs = 1;
  assert.equal(applyOffline(s, 3), null);
  assert.equal(s.totalEnergy, 0);
  const r = applyOffline(s, 10 * 3600);
  assert.equal(r.away, 36000);
  assert.equal(r.counted, 3600);
  assert.equal(r.energy, 10 * 3600 * 0.5);
  assert.equal(s.totalEnergy, r.energy);
  assert.equal(r.money, s.money);
  assert.equal(r.rp, 0.25 * 1800);
  assert.equal(applyOffline(newState(), 7200, 7200).counted, 7200); // teto ajustável (Legado)
});

test('income = power × price', () => {
  const s = newState();
  s.owned.wind = 3; s.t = 10;
  assert.equal(income(s), power(s) * price(s));
});
