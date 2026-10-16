import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSettings, writeSettings, DEFAULT_SETTINGS } from '../src/storage/settings.js';
import { writeSlot, readSlot, exportSlot, importSlot, importPath, encodeSave, decodeSave } from '../src/storage/saves.js';
import { newState } from '../src/core/state.js';
import { createApp } from '../src/ui/app.js';
import { createScreen, parseLine } from '../src/ui/screen.js';
import { setColorMode, setUnicode, toAscii } from '../src/ui/theme.js';
import { fmt, setNumberFormat, stripAnsi, visibleLength } from '../src/ui/format.js';

// Tema e formato são globais da UI: cada teste devolve o padrão.
afterEach(() => { setColorMode('full'); setUnicode(true); setNumberFormat('short'); });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'elden-grid-opt-'));

test('settings: padrões, ida e volta e valores inválidos descartados campo a campo', () => {
  const dir = tmp();
  assert.deepEqual(readSettings(dir), DEFAULT_SETTINGS);
  writeSettings({ ...DEFAULT_SETTINGS, animations: 'off', fps: 5, unicode: false, colors: 'none', numbers: 'sci', autosaveSec: 60 }, dir);
  const s = readSettings(dir);
  assert.deepEqual([s.animations, s.fps, s.unicode, s.colors, s.numbers, s.autosaveSec], ['off', 5, false, 'none', 'sci', 60]);
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ fps: 999, colors: 'neon', unicode: 'sim', animations: 'reduced' }));
  const bad = readSettings(dir);
  assert.equal(bad.fps, DEFAULT_SETTINGS.fps);
  assert.equal(bad.colors, DEFAULT_SETTINGS.colors);
  assert.equal(bad.unicode, true);
  assert.equal(bad.animations, 'reduced');
});

test('save em texto: Base64 de ida e volta, exportar arquivo e importar em outro slot', () => {
  const dir = tmp();
  const s = newState();
  s.money = 4242;
  assert.equal(decodeSave(encodeSave(s, 7)).state.money, 4242);
  assert.equal(exportSlot(1, dir), null); // slot vazio
  writeSlot(1, s, dir);
  const ex = exportSlot(1, dir);
  assert.ok(/^[A-Za-z0-9+/=]+$/.test(ex.text));
  assert.equal(fs.readFileSync(ex.path, 'utf8').trim(), ex.text);
  assert.match(importSlot(2, dir).reason, /não encontrado/);
  fs.writeFileSync(importPath(dir), 'isto não é um save');
  assert.match(importSlot(2, dir).reason, /não é um save válido/);
  fs.writeFileSync(importPath(dir), `  ${ex.text}\n\n`); // espaços e quebras colados juntos
  assert.deepEqual(importSlot(2, dir), { ok: true });
  assert.equal(readSlot(2, dir).state.money, 4242);
});

test('modo sem cor: só negrito/esmaecido/inverso; paint sem cor não emite reset', () => {
  setColorMode('none');
  const { app } = make({ colors: 'none' });
  const text = app.lines(80, 24).join('');
  assert.doesNotMatch(text, /\x1b\[3\dm|\x1b\[9\dm|\x1b\[38;5/);
  assert.match(text, /\x1b\[1m|\x1b\[7m/);
});

test('NO_COLOR vence a opção de cores e trava o item nas Opções', () => {
  const { app, press, text, calls } = make({ colors: 'full' }, { noColor: true });
  assert.doesNotMatch(app.lines(80, 24).join(''), /\x1b\[3\dm/);
  press('1', 'o', 'down', 'down', 'down');
  assert.match(text(), /Cores +sem cor \(NO_COLOR\)/);
  press('right');
  assert.equal(calls.settings, 0);
  assert.match(text(), /NO_COLOR está definido/);
});

test('ASCII puro: o screen troca todo símbolo por ASCII e mantém os acentos', () => {
  const cells = parseLine('⚡ ─│█▲✓ Eólica ☾', 20, true).map((c) => c.ch).join('');
  assert.equal(cells.trimEnd(), '! -|#^v Eólica C');
  const sc = createScreen();
  sc.resize(10, 1);
  sc.setAscii(true);
  assert.equal(stripAnsi(sc.frame(['─▲'])).replace(/\x1b\[[0-9;]*H/g, ''), '-^');
});

test('todo símbolo usado nas telas tem equivalente ASCII', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const files = ['ui', 'ui/screens', 'ui/art', 'data'].flatMap((d) =>
    fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.js')).map((f) => path.join(root, d, f)));
  const missing = new Set();
  for (const f of files) {
    for (const ch of fs.readFileSync(f, 'utf8')) {
      // Letras acentuadas (e ª/º) são texto em português, não desenho.
      if (ch.codePointAt(0) > 127 && !/\p{L}/u.test(ch) && toAscii(ch) === ch) missing.add(ch);
    }
  }
  assert.deepEqual([...missing], []);
});

test('números científicos: cabeçalho e fmt mudam na hora', () => {
  const s = newState();
  s.money = 1234567;
  const { app, press, text } = make({}, { state: s });
  press('1');
  assert.match(text(), /Dinheiro \$1\.23M/);
  press('o', 'down', 'down', 'down', 'down', 'right');
  assert.equal(app.settingsRef.numbers, 'sci');
  assert.match(text(), /Dinheiro \$1\.23e6/);
  assert.equal(fmt(999), '999.0');
});

test('animações desligadas: sem partículas, números saltam e a cena congela', () => {
  const s = newState();
  s.owned.wind = 3;
  s.money = 100;
  const { app, press, text } = make({ animations: 'off' }, { state: s });
  press('1');
  const first = text();
  for (let i = 0; i < 7; i++) app.update(0.1, (i + 1) * 137);
  press('space');
  app.update(0.1, 1000);
  assert.deepEqual(app.overlays(80, 24), []);
  assert.match(text(), new RegExp(`Dinheiro \\$${fmt(app.state.money).replace('.', '\\.')} `)); // sem rolagem
  const sceneOf = (t) => t.split('\n').slice(4, 9).join('\n');
  assert.equal(sceneOf(text()), sceneOf(first)); // turbinas paradas
});

test('animações reduzidas: sem partículas, mas a cena ainda anda', () => {
  const s = newState();
  s.owned.wind = 3;
  const { app, press, text } = make({ animations: 'reduced' }, { state: s });
  press('1', 'space');
  assert.deepEqual(app.overlays(80, 24), []);
  const sceneOf = () => text().split('\n').slice(4, 9).join('\n');
  const seen = new Set();
  for (let i = 0; i < 20; i++) { app.update(0.1, i * 250); seen.add(sceneOf()); }
  assert.ok(seen.size > 1);
});

test('Opções: percorre valores com ←→, persiste e cabe em 80×24 (menu e aba)', () => {
  const { app, press, text, calls } = make();
  press('4'); // Opções pelo menu
  assert.match(text(), /Animações +‹ ligadas ›/);
  press('right');
  assert.equal(app.settingsRef.animations, 'reduced');
  press('left', 'left');
  assert.equal(app.settingsRef.animations, 'off');
  assert.equal(calls.settings, 3);
  for (let i = 0; i < 8; i++) {
    for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
    press('down');
  }
  assert.match(text(), /Esc voltar/);
  press('escape', '1', 'o');
  assert.equal(app.tab, 'options');
});

test('exportar e importar pela tela: exporta o jogo aberto; importar no slot aberto recarrega', () => {
  const s = newState();
  s.money = 10;
  const imported = newState();
  imported.money = 777;
  const { app, press, text, store } = make({}, { state: s, imported });
  press('1');
  app.state.money = 55;
  app.update(0.1, 100);
  press('o');
  for (let i = 0; i < 7; i++) press('down');
  press('enter');
  assert.equal(store.data[1].state.money, 55); // salvou antes de exportar
  assert.match(text(), /Save exportado .* e copiado/);
  press('down', 'enter');
  assert.match(text(), /Importar import\.txt para o slot 1\?/);
  press('S');
  assert.match(text(), /Save importado para o slot 1/);
  assert.equal(app.state.money, 777);
});

function make(settings = {}, { noColor = false, state = newState(), imported = null } = {}) {
  const data = { 1: { status: 'ok', savedAt: null, state } };
  const store = {
    data,
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(data[n] ?? { status: 'empty' }) })),
    load: (n) => (data[n] ? { ...data[n], state: structuredClone(data[n].state) } : { status: 'empty' }),
    save: (n, st) => { data[n] = { status: 'ok', savedAt: null, state: structuredClone(st) }; return true; },
    remove() {},
    exportText: (n) => ({ text: encodeSave(data[n].state, 1), path: `/tmp/export-slot${n}.txt` }),
    importText: (n) => { data[n] = { status: 'ok', savedAt: null, state: structuredClone(imported) }; return { ok: true }; },
  };
  const calls = { settings: 0 };
  const settingsRef = { lastSlot: 1, ...settings };
  const app = createApp({ store, settings: settingsRef, now: 0, noColor, onSettings: () => calls.settings++, copy: () => true });
  app.settingsRef = settingsRef;
  const press = (...keys) => keys.forEach((k) => app.key(k));
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, press, text, calls, store };
}
