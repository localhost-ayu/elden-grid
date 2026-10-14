import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/ui/app.js';
import { newState } from '../src/core/state.js';
import { GENERATORS } from '../src/data/generators.js';
import { TECHS } from '../src/data/research.js';
import { sceneRows, sceneCards, CARD_H } from '../src/ui/scene.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

function lateState() {
  const s = newState();
  for (const t of TECHS) s.techs[t.id] = true;
  for (const g of GENERATORS) s.owned[g.id] = 3;
  s.upgrades.wind = 2;
  s.labs = 2;
  s.money = 1e9;
  return s;
}

function make(state) {
  const slots = { 1: { status: 'ok', savedAt: null, state } };
  const store = {
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })),
    load: (n) => slots[n],
    save: () => true,
    remove() {},
  };
  const app = createApp({ store, now: 0, rng: () => 0.5 });
  app.key('1'); // Continuar
  const text = (cols = 80, rows = 24) => app.lines(cols, rows).map(stripAnsi).join('\n');
  return { app, text };
}

test('cena: um card por tipo comprado, com quantidade e nível de upgrade', () => {
  const s = newState();
  s.owned.wind = 12;
  s.upgrades.wind = 2;
  s.owned.nuclear = 1;
  s.labs = 1;
  assert.deepEqual(sceneCards(s).map((c) => c.lab ? 'lab' : c.g.id), ['wind', 'nuclear', 'lab']);
  const text = sceneRows(s, 0, 80, 1).map(stripAnsi).join('\n');
  assert.equal(sceneRows(s, 0, 80, 1).length, CARD_H);
  assert.match(text, /Eólica/);
  assert.match(text, /x12 +nv2\/5/);
  assert.match(text, /Nuclear/);
  assert.match(text, /Laboratório/);
});

test('cena: sem espaço para todos, o último card vira "+N fontes"', () => {
  const s = lateState();
  const rows = sceneRows(s, 0, 80, 1).map(stripAnsi);
  assert.match(rows.join('\n'), /\+6 fontes/); // 6 por fileira em 80 col: 5 cards + aviso
  for (const l of rows) assert.ok(visibleLength(l) <= 80);
});

test('reator desligado aparece no card', () => {
  const s = newState();
  s.techs.t_nuclear = true;
  s.owned.nuclear = 2;
  s.heat.nuclear = { h: 1, off: 10 };
  assert.match(sceneRows(s, 0, 80, 1).map(stripAnsi).join('\n'), /x2 +DESLIG\./);
});

test('V alterna lista e cena; a cena inteira cabe em 80×24 com todas as fontes', () => {
  const { app, text } = make(lateState());
  assert.match(text(), /V cena/);
  app.key('v');
  const t = text();
  assert.match(t, /Usinas .* 11 tipos/);
  assert.doesNotMatch(t, /fontes\b.*\+\d/); // nada escondido: 11 cards em 2 fileiras
  for (const name of ['Eólica', 'Antimatéria', 'Laboratório']) assert.match(t, new RegExp(name));
  assert.match(t, /V volta à lista/);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80);
  assert.equal(app.lines(80, 24).length, 24);
  app.key('V');
  assert.match(text(), /Turbina Eólica +x3/);
});

test('lista: cena aparece quando sobra altura e some quando não sobra', () => {
  const early = newState();
  early.owned.wind = 2;
  const a = make(early);
  assert.match(a.text(), /Eólica\s/); // card da eólica acima da lista
  const late = make(lateState());
  assert.doesNotMatch(late.text(80, 24), /x3 +nv2\/5/); // 80×24 lotado: só a lista
  assert.match(late.text(120, 40), /x3 +nv2\/5/);    // terminal alto: cards de volta
});

test('manivela solta partículas na cena, nunca fora dela', () => {
  const s = newState();
  s.owned.wind = 1;
  const { app } = make(s);
  app.lines(80, 24);
  app.key('space');
  const ov = app.overlays(80, 24);
  assert.equal(ov.length, 2);
  assert.ok(ov.some((o) => /kWh/.test(o.text)) && ov.some((o) => /^\+\$/.test(o.text)));
  // a cena ocupa as linhas 4..10 do quadro (cabeçalho de 4 linhas + card de 7)
  for (const o of ov) assert.ok(o.row >= 4 && o.row <= 10, `linha ${o.row}`);
  app.key('p'); // aba sem cena: sem partículas
  app.lines(80, 24);
  assert.deepEqual(app.overlays(80, 24), []);
  app.key('g');
  for (let i = 0; i < 20; i++) app.update(0.1, i * 100);
  assert.ok(app.overlays(80, 24).every((o) => /^\+\$/.test(o.text))); // as da manivela já sumiram
});

test('contador de dinheiro rola até o valor real em vez de saltar', () => {
  const s = newState();
  s.money = 1000;
  const { app, text } = make(s);
  assert.match(text(), /Dinheiro \$1\.00k/); // abrir o save não rola do zero
  app.state.money = 2000;
  app.update(0.05, 50);
  const mid = Number(text().match(/Dinheiro \$([\d.]+)k/)[1]);
  assert.ok(mid > 1 && mid < 2, `meio do caminho: ${mid}`);
  for (let i = 0; i < 30; i++) app.update(0.05, 100 + i * 50);
  assert.match(text(), /Dinheiro \$2\.\d\dk/);
});

test('cabeçalho mostra a seta de tendência do preço', () => {
  const s = newState();
  const { text } = make(s);
  assert.match(text(), /Preço \$1\.00\/kWh ▲/);
});
