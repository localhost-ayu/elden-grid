// Modo disfarce: a tecla \ esconde o jogo de qualquer tela, sem deixar nada dele à vista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/ui/app.js';
import { newState } from '../src/core/state.js';
import { holdEvents, eventsStep } from '../src/core/incidents.js';
import { DISGUISES, createDisguise, stepDisguise, disguiseKey, renderDisguise } from '../src/ui/stealth.js';
import { stripAnsi } from '../src/ui/format.js';

// Gerador fixo: as telas de disfarce ficam iguais a cada execução.
function seeded(seed = 7) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function make(settings = {}) {
  const state = newState();
  state.money = 1000;
  state.owned.wind = 10;
  const store = {
    data: { 1: { status: 'ok', savedAt: null, state } },
    calls: 0,
    list() { return [1, 2, 3].map((n) => ({ slot: n, ...(this.data[n] ?? { status: 'empty' }) })); },
    load(n) { return this.data[n] ? { ...this.data[n], state: structuredClone(this.data[n].state) } : { status: 'empty' }; },
    save(n, s) { this.calls++; this.data[n] = { status: 'ok', savedAt: 0, state: structuredClone(s) }; return true; },
    remove() {},
  };
  const app = createApp({ store, settings, now: 0, rng: seeded(), who: { user: 'ana', host: 'note' } });
  const press = (...keys) => keys.forEach((k) => app.key(k));
  const text = (cols = 80, rows = 24) => app.lines(cols, rows).map(stripAnsi).join('\n');
  return { app, store, press, text };
}

const GAME_WORDS = /ELDEN|GRID|Geradores|Dinheiro|Legado|kWh|manivela|disfarce/i;

test('\\ esconde e mostra o jogo de qualquer modo; nada do jogo aparece escondido', () => {
  for (const disguise of DISGUISES) {
    const { app, press, text } = make({ disguise });
    assert.match(text(), /ELDEN GRID|Continuar/); // menu
    press('\\');
    assert.equal(app.hidden, true);
    assert.doesNotMatch(text(), GAME_WORDS, disguise);
    press('\\', '1'); // volta ao menu e continua o jogo
    assert.equal(app.mode, 'game');
    press('\\');
    assert.doesNotMatch(text(), GAME_WORDS, disguise);
    assert.deepEqual(app.overlays(80, 24), []);
    press('\\');
    assert.equal(app.hidden, false);
    assert.match(text(), /Geradores/);
  }
});

test('escondido, as teclas do jogo não fazem nada (nem Q sai); Ctrl+C ainda sai salvando', () => {
  let quit = 0;
  const { app, press } = make({ disguise: 'build' });
  press('1', '\\', 'q', 'm', 'escape', 'space', '1', 'tab');
  assert.equal(app.mode, 'game');
  assert.equal(app.tab, 'gens');
  assert.equal(app.state.owned.wind, 10); // "1" não comprou
  assert.equal(app.hidden, true);
  const app2 = createApp({ store: { list: () => [], load: () => ({}), save: () => true, remove() {} }, onQuit: () => quit++ });
  app2.key('\\');
  app2.key('ctrl-c');
  assert.equal(quit, 1);
});

test('esconder salva na hora; a produção continua e a volta mostra quanto rendeu', () => {
  const { app, store, press, text } = make();
  press('1');
  const before = store.calls;
  press('\\');
  assert.equal(store.calls, before + 1);
  const money = app.state.money;
  app.update(5, 5000);
  assert.ok(app.state.money > money);
  press('\\');
  assert.match(text(), /De volta! Enquanto o jogo estava escondido: \+\$/);
});

test('escondido, eventos não começam e o prazo da crise não corre', () => {
  const { app, press } = make();
  press('1');
  const s = app.state;
  s.events.next = s.t + 1;
  press('\\');
  for (let i = 0; i < 100; i++) app.update(1, 1000 * (i + 1));
  assert.equal(s.events.effects.length, 0);
  assert.equal(s.events.seen, 0);
  assert.ok(s.events.next > s.t);
  press('\\');
  app.update(1.5, 200000);
  assert.equal(s.events.seen, 1); // de volta, o evento que estava para vir acontece
});

test('holdEvents: crise aberta não estoura o prazo; efeitos passivos expiram no tempo normal', () => {
  const s = newState();
  s.t = 100;
  s.events.crisis = { id: 'blackout', deadline: 110, game: null };
  s.events.effects = [{ id: 'blackout', until: null }, { id: 'demand', until: 105 }];
  for (let i = 0; i < 30; i++) { s.t += 1; holdEvents(s, 1); }
  assert.equal(s.events.crisis.deadline, 140);
  assert.ok(s.t < s.events.crisis.deadline);
  eventsStep(s, 0);
  assert.ok(s.events.crisis, 'crise continua aberta, sem cobrança');
  assert.equal(s.events.effects.some((a) => a.id === 'demand'), false); // o bônus não foi esticado
});

test('disfarces: tela sempre cheia na largura certa, linhas novas com o tempo', () => {
  for (const kind of DISGUISES) {
    const d = createDisguise(kind, { now: 1e12, rng: seeded(), user: 'ana', host: 'note' });
    for (const [cols, rows] of [[80, 24], [40, 10], [200, 60]]) {
      const lines = renderDisguise(d, cols, rows, 1e12).map(stripAnsi);
      assert.equal(lines.length, rows);
      assert.ok(lines.every((l) => [...l].length <= cols), `${kind} ${cols}x${rows}`);
    }
  }
  const logs = createDisguise('logs', { now: 1e12, rng: seeded() });
  const n = logs.lines.length;
  assert.ok(n >= 20, 'o log já abre com a tela cheia');
  stepDisguise(logs, 1e12 + 30000);
  assert.ok(logs.lines.length > n);
  const build = createDisguise('build', { now: 1e12, rng: seeded() });
  assert.match(renderDisguise(build, 80, 24, 1e12).map(stripAnsi).join('\n'), /Waiting for file changes/);
  stepDisguise(build, 1e12 + 60000);
  assert.match(build.lines.map((l) => l.map((x) => x[1]).join('')).join('\n'), /RERUN/);
});

test('disfarce não despeja horas de linhas depois de um sono longo', () => {
  const d = createDisguise('logs', { now: 0, rng: seeded() });
  stepDisguise(d, 3600 * 1000 * 5);
  assert.ok(d.lines.length <= 300);
});

test('shell: digitar aparece no prompt; Enter responde como um shell; clear limpa', () => {
  const d = createDisguise('shell', { now: 0, rng: seeded(), user: 'ana', host: 'note' });
  const screen = (now = 0) => renderDisguise(d, 80, 5, now).map(stripAnsi);
  assert.equal(screen()[0], 'ana@note:~$ █');
  assert.equal(screen(600)[0], 'ana@note:~$  '); // cursor pisca
  for (const k of [...'git', 'space', ...'stauts']) disguiseKey(d, k);
  disguiseKey(d, 'backspace');
  disguiseKey(d, 'enter');
  assert.deepEqual(screen().slice(0, 3), ['ana@note:~$ git staut', 'git: command not found', 'ana@note:~$ █']);
  for (const k of [...'clear', 'enter']) disguiseKey(d, k);
  assert.equal(screen()[0], 'ana@note:~$ █');
});

test('opção Disfarce percorre os três tipos e fica no settings', () => {
  const settings = {};
  const { press, text } = make(settings);
  assert.equal(settings.disguise, 'build');
  press('1', 'o');
  for (let i = 0; i < 6; i++) press('down');
  assert.match(text(), /Disfarce\s+‹ testes rodando ›/);
  press('right');
  assert.equal(settings.disguise, 'logs');
  press('\\');
  assert.match(text(), /\[http\]|\[db\]|\[cache\]|\[jobs\]|\[queue\]/);
});
