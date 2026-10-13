// Tudo numa pasta temporária: nunca toca ~/.reactor-ascii do jogador.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newState, migrate, SAVE_VERSION, isValidState } from '../src/core/state.js';
import {
  readSlot, writeSlot, deleteSlot, listSlots, importLegacy, slotPath, writeJsonAtomic,
} from '../src/storage/saves.js';
import { readSettings, writeSettings, DEFAULT_SETTINGS } from '../src/storage/settings.js';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactor-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const stateWith = (money) => Object.assign(newState(), { money });

// Save v1: estado achatado + savedAt, sem saveVersion.
const MVP_SAVE = {
  money: 1234.5, totalEnergy: 9876, rp: 42, labs: 2, t: 600, savedAt: 1_700_000_000_000,
  owned: { wind: 12, solar: 3, hydro: 0, gas: 0, nuclear: 0, fusion: 0 },
  techs: { t_wind2: true, t_solar: true },
};

test('migrate: MVP (v1) -> v2 preserva todo o progresso', () => {
  const env = migrate(structuredClone(MVP_SAVE));
  assert.equal(env.saveVersion, SAVE_VERSION);
  assert.equal(env.savedAt, MVP_SAVE.savedAt);
  assert.equal(env.state.money, 1234.5);
  assert.equal(env.state.owned.wind, 12);
  assert.deepEqual(env.state.techs, { t_wind2: true, t_solar: true });
  assert.equal(env.state.savedAt, undefined);
});

test('migrate: rejeita lixo e saves de versão futura', () => {
  assert.throws(() => migrate(null));
  assert.throws(() => migrate([1, 2]));
  assert.throws(() => migrate({ saveVersion: 0 }));
  assert.throws(() => migrate({ saveVersion: SAVE_VERSION + 1, state: {} }), /mais nova/);
});

test('isValidState recusa NaN, negativos e contagens quebradas', () => {
  assert.ok(isValidState(newState()));
  assert.ok(!isValidState({ ...newState(), money: NaN }));
  assert.ok(!isValidState({ ...newState(), rp: -1 }));
  assert.ok(!isValidState({ ...newState(), owned: { wind: 1.5 } }));
  assert.ok(!isValidState({ ...newState(), labs: Infinity }));
});

test('slot vazio, gravação e leitura com saveVersion e savedAt', () => {
  assert.equal(readSlot(1, dir).status, 'empty');
  assert.ok(writeSlot(1, stateWith(10), dir, 5000));
  const raw = JSON.parse(fs.readFileSync(slotPath(1, dir), 'utf8'));
  assert.equal(raw.saveVersion, SAVE_VERSION);
  const r = readSlot(1, dir);
  assert.equal(r.status, 'ok');
  assert.equal(r.savedAt, 5000);
  assert.equal(r.state.money, 10);
});

test('escrita atômica: sem .tmp sobrando e .bak guarda a versão anterior', () => {
  writeSlot(1, stateWith(1), dir);
  assert.ok(!fs.existsSync(slotPath(1, dir) + '.bak')); // 1ª gravação: nada a guardar
  writeSlot(1, stateWith(2), dir);
  assert.ok(!fs.existsSync(slotPath(1, dir) + '.tmp'));
  const bak = JSON.parse(fs.readFileSync(slotPath(1, dir) + '.bak', 'utf8'));
  assert.equal(bak.state.money, 1);
  assert.equal(readSlot(1, dir).state.money, 2);
});

test('arquivo corrompido: recupera do .bak; ambos ruins -> corrupt, sem lançar', () => {
  writeSlot(2, stateWith(1), dir);
  writeSlot(2, stateWith(2), dir);
  fs.writeFileSync(slotPath(2, dir), '{"saveVersion":2,"state":{"mon'); // gravação cortada
  const r = readSlot(2, dir);
  assert.equal(r.status, 'recovered');
  assert.equal(r.state.money, 1);
  fs.writeFileSync(slotPath(2, dir) + '.bak', 'lixo');
  assert.deepEqual(readSlot(2, dir), { status: 'corrupt' });
});

test('arquivo corrompido nunca sobrescreve um .bak bom', () => {
  writeSlot(1, stateWith(1), dir);
  writeSlot(1, stateWith(2), dir); // .bak = 1
  fs.writeFileSync(slotPath(1, dir), 'corrompido');
  writeSlot(1, stateWith(3), dir); // atual ruim não vira backup
  assert.equal(JSON.parse(fs.readFileSync(slotPath(1, dir) + '.bak', 'utf8')).state.money, 1);
  assert.equal(readSlot(1, dir).state.money, 3);
});

test('estado inválido não é gravado (protege o save bom)', () => {
  writeSlot(1, stateWith(7), dir);
  assert.equal(writeSlot(1, stateWith(NaN), dir), false);
  assert.equal(readSlot(1, dir).state.money, 7);
});

test('listSlots e deleteSlot', () => {
  writeSlot(3, stateWith(1), dir);
  writeSlot(3, stateWith(2), dir);
  assert.deepEqual(listSlots(dir).map((s) => s.status), ['empty', 'empty', 'ok']);
  deleteSlot(3, dir);
  assert.deepEqual(listSlots(dir).map((s) => s.status), ['empty', 'empty', 'empty']);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('importa o save do MVP para o slot 1 uma única vez, sem perder o original', () => {
  const legacy = path.join(dir, 'legacy.json');
  const saves = path.join(dir, 'saves');
  fs.writeFileSync(legacy, JSON.stringify(MVP_SAVE));
  assert.equal(importLegacy(saves, legacy), true);
  const r = readSlot(1, saves);
  assert.equal(r.status, 'ok');
  assert.equal(r.state.owned.wind, 12);
  assert.equal(r.savedAt, MVP_SAVE.savedAt); // o tempo offline continua contando
  assert.ok(!fs.existsSync(legacy));
  assert.ok(fs.existsSync(legacy + '.migrated'));
  assert.equal(importLegacy(saves, legacy), false); // segunda execução: nada a fazer
});

test('importação não sobrescreve slot 1 em uso nem importa arquivo ilegível', () => {
  const legacy = path.join(dir, 'legacy.json');
  fs.writeFileSync(legacy, JSON.stringify(MVP_SAVE));
  writeSlot(1, stateWith(5), dir);
  assert.equal(importLegacy(dir, legacy), false);
  assert.equal(readSlot(1, dir).state.money, 5);
  fs.writeFileSync(legacy, '{quebrado');
  assert.equal(importLegacy(path.join(dir, 'outro'), legacy), false);
  assert.ok(fs.existsSync(legacy)); // fica onde está para o jogador decidir
});

test('settings: padrões, ida e volta, e valores inválidos descartados', () => {
  assert.deepEqual(readSettings(dir), DEFAULT_SETTINGS);
  writeSettings({ ...DEFAULT_SETTINGS, lastSlot: 2, autosaveSec: 30 }, dir);
  writeSettings({ ...DEFAULT_SETTINGS, lastSlot: 2, autosaveSec: 30 }, dir); // agora existe .bak
  assert.equal(readSettings(dir).lastSlot, 2);
  assert.equal(readSettings(dir).autosaveSec, 30);
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ lastSlot: 9, autosaveSec: 1 }));
  assert.deepEqual(readSettings(dir), DEFAULT_SETTINGS);
  fs.writeFileSync(path.join(dir, 'settings.json'), 'não é json');
  assert.equal(readSettings(dir).autosaveSec, 30); // veio do .bak
});

test('writeJsonAtomic cria a pasta se não existir', () => {
  const f = path.join(dir, 'a', 'b', 'x.json');
  writeJsonAtomic(f, { ok: 1 });
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { ok: 1 });
});
