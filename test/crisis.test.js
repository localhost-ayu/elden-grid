import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/ui/app.js';
import { newState } from '../src/core/state.js';
import { SCHEDULE, CRISIS } from '../src/data/events.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

function make(crisisId) {
  const s = newState();
  s.owned.wind = 20;
  s.owned.nuclear = 1;
  s.money = 1e6;
  if (crisisId) {
    s.events.effects.push({ id: crisisId, until: null });
    s.events.crisis = { id: crisisId, deadline: SCHEDULE.crisisDeadline, game: null };
  }
  s.events.next = 1e9; // nada de sorteio no meio do teste
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = {
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })),
    load: (n) => slots[n],
    save: () => true,
    remove() {},
  };
  const app = createApp({ store, now: 0 });
  app.key('1');
  const press = (...keys) => keys.forEach((k) => app.key(k));
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, press, text };
}

const fits = (app) => {
  const lines = app.lines(80, 24);
  assert.equal(lines.length, 24);
  for (const l of lines) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
};

test('sem crise, X só avisa', () => {
  const { app, press, text } = make();
  press('x');
  assert.match(text(), /Nenhuma crise agora/);
  assert.equal(app.tab, 'gens');
});

test('banner da crise no topo com relógio; X abre o manual e ele segura as teclas', () => {
  const { app, press, text } = make('blackout');
  assert.match(text(), /⚠ BLECAUTE REGIONAL · \[X\] manual de crise · equipe em 1:30/);
  press('x');
  assert.match(text(), /Manual de crise · Religar a rede/);
  assert.match(text(), /Enter começa/);
  const money = app.state.money;
  press('space', 'g', 'tab', 'm', 'q'); // nada disso escapa do manual
  assert.equal(app.state.money, money); // espaço não girou a manivela
  assert.equal(app.mode, 'game');
  assert.match(text(), /Manual de crise/);
  press('escape');
  assert.doesNotMatch(text(), /Manual de crise/);
  assert.ok(app.state.events.crisis); // fechar o manual não resolve a crise
});

test('P pede confirmação; N cancela, S paga a equipe e fecha', () => {
  const { app, press, text } = make('blackout');
  press('x', 'p');
  assert.match(text(), /Chamar a equipe por \$[\d.]+k?\? +\(S\/N\)/);
  press('n');
  assert.ok(app.state.events.crisis);
  press('p', 'S');
  assert.equal(app.state.events.crisis, null);
  assert.ok(app.state.money < 1e6);
  assert.match(text(), /Equipe chamada: o blecaute regional foi resolvido por \$/);
  assert.doesNotMatch(text(), /Manual de crise/);
});

test('resolver pelo teclado: sem custo, bônus e mensagem de vitória', () => {
  const { app, press, text } = make('overload');
  press('x', 'enter');
  const money = app.state.money;
  press(...app.state.events.crisis.game.seq);
  assert.equal(app.state.events.crisis, null);
  assert.equal(app.state.money, money);
  assert.match(text(), /Sobrecarga na subestação resolvida por você! Sem custo \+ Rede afinada/);
  assert.match(text(), /── Rede afinada · produção x1\.25 · 0:45/);
});

test('ignorar a crise: a equipe resolve sozinha no prazo e o manual fecha', () => {
  const { app, press, text } = make('blackout');
  press('x');
  for (let i = 0; i <= SCHEDULE.crisisDeadline * 10; i++) app.update(0.1, i * 100);
  assert.equal(app.state.events.crisis, null);
  assert.match(text(), /Ninguém atendeu: a equipe resolveu o blecaute regional sozinha/);
  assert.doesNotMatch(text(), /Manual de crise/);
});

test('todas as crises cabem em 80×24: alerta, jogando e confirmando, no nível 0 e no máximo', () => {
  for (const level of [0, CRISIS.maxLevel]) {
    for (const id of ['blackout', 'heatwave_crisis', 'overload', 'containment', 'solarstorm']) {
      const { app, press, text } = make(id);
      app.state.legacy.ascensions = level;
      press('x');
      fits(app);
      assert.match(text(), new RegExp(`crise nível ${level}/${CRISIS.maxLevel}`));
      press('enter');
      app.update(5, 100); // passa do tempo em que a sequência some no nível alto
      fits(app);
      press('p');
      fits(app);
    }
  }
});

test('evento passivo aparece no banner com contagem regressiva', () => {
  const { app, text } = make();
  app.state.events.effects.push({ id: 'storm', until: app.state.t + 45 });
  assert.match(text(), /── Tempestade · eólica x2, solar x0\.5 · 0:45/);
});
