import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../src/core/state.js';
import { GENERATORS } from '../src/data/generators.js';
import { genLaunch, genBuyable, genPower, power, feedFactor } from '../src/core/engine.js';
import { buyGenBulk } from '../src/core/actions.js';
import { cheapestGen } from '../src/core/automation.js';
import { createApp } from '../src/ui/app.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);

function make(state) {
  const slots = { 1: { status: 'ok', savedAt: null, state } };
  const store = {
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })),
    load: (n) => slots[n],
    save: () => true,
    remove() {},
  };
  const app = createApp({ store, now: 0, rng: () => 0.5 });
  app.key('1');
  state.events.next = 1e9;
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, text };
}

test('Enxame: só se compra na janela de lançamento; a pesquisa alarga a janela', () => {
  const s = newState();
  const g = gen('swarm');
  const tr = g.traits.find((x) => x.type === 'launch');
  s.techs.t_orbital = true;
  s.money = 1e15;
  s.t = 0;
  assert.deepEqual(genLaunch(s, g), { open: true, left: tr.window });
  assert.equal(buyGenBulk(s, 'swarm', 1), 1);
  s.t = tr.window + 1;
  assert.equal(genLaunch(s, g).open, false);
  assert.equal(genLaunch(s, g).left, tr.period - tr.window - 1);
  assert.equal(genBuyable(s, g), false);
  assert.equal(buyGenBulk(s, 'swarm', 1), 0, 'fora da janela não compra');
  s.techs.t_launch = true;
  assert.equal(genLaunch(s, g).open, true, 'Foguetes Reutilizáveis alargam a janela');
  s.t = tr.period; // a janela reabre a cada período
  s.techs.t_launch = false;
  assert.equal(genLaunch(s, g).open, true);
  assert.equal(genLaunch(s, gen('wind')), null, 'fontes sem janela');
});

test('Enxame: produção fixa (sem noite) e a auto-compra pula a janela fechada', () => {
  const s = newState();
  s.techs.t_orbital = true;
  s.owned.swarm = 1;
  const kw = [0, 6, 12, 18].map((h) => { s.t = h; return power(s); });
  assert.ok(kw.every((x) => Math.abs(x - kw[0]) < 1e-6 * kw[0]), 'sem dia e noite');
  for (const g of GENERATORS) s.owned[g.id] = g.id === 'swarm' ? 0 : 400; // todas caras
  s.t = 30; // fechada
  assert.notEqual(cheapestGen(s)?.id, 'swarm');
});

test('aba Geradores: página 2 com a Fronteira, ←→ troca e as teclas valem na página aberta', () => {
  const s = newState();
  s.money = 1e15;
  const { app, text } = make(s);
  assert.doesNotMatch(text(), /pág\./, 'uma página só no começo');
  app.key('right');
  assert.doesNotMatch(text(), /pág\./);
  s.techs.t_orbital = true;
  assert.match(text(), /fonte · pág\. 1\/2 ←→/);
  assert.match(text(), /←→ página/);
  app.key('right');
  const t = text();
  assert.match(t, /pág\. 2\/2/);
  assert.match(t, /\[1\] Enxame Solar Orbital/);
  assert.match(t, /janela aberta|lançamento em/);
  assert.doesNotMatch(t, /Turbina Eólica/);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  app.key('1');
  assert.ok(s.owned.swarm > 0, 'a tecla 1 da página 2 compra o Enxame');
  assert.equal(s.owned.wind, 0);
  app.state.t = 30;
  app.key('1');
  assert.match(text(), /próxima janela de lançamento abre em \d+ s/);
  app.key('left');
  app.key('1');
  assert.ok(s.owned.wind > 0, 'de volta à página 1, a tecla 1 é a eólica');
});

test('Kugelblitz: rende a fração de alimentação que as outras fontes dão; Acreção Controlada ajuda', () => {
  const s = newState();
  const k = gen('kugelblitz');
  s.techs.t_kugel = true;
  s.owned.kugelblitz = 1;
  assert.equal(feedFactor(s, k), 0, 'sozinho, sem alimentação');
  assert.equal(power(s), 0);
  const share = k.traits.find((t) => t.type === 'feed').share;
  // Fonte estável (sem vento/sol) para a conta ficar exata.
  s.techs.t_geo = true;
  const geo = gen('geothermal');
  s.owned.geothermal = 10;
  const expected = genPower(s, geo) / (share * k.output);
  assert.ok(expected > 0 && expected < 0.5);
  assert.ok(Math.abs(feedFactor(s, k) - expected) < 1e-9);
  assert.ok(Math.abs(genPower(s, k) - k.output * expected) < 1e-3, 'rende só a parte alimentada');
  s.techs.t_feed = true; // precisa de metade: rende o dobro
  assert.ok(Math.abs(feedFactor(s, k) - 2 * expected) < 1e-9);
  s.owned.geothermal = 1e5;
  assert.equal(feedFactor(s, k), 1, 'nunca passa de 100%');
  s.owned.kugelblitz = 0;
  assert.equal(feedFactor(s, k), 1);
});
