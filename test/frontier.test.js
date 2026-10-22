import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../src/core/state.js';
import { GENERATORS } from '../src/data/generators.js';
import { genLaunch, genBuyable, genPower, genEnv, power, feedFactor } from '../src/core/engine.js';
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
  s.chapter = 'solar';
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
  s.chapter = 'solar';
  s.techs.t_orbital = true;
  s.owned.swarm = 1;
  const kw = [0, 6, 12, 18].map((h) => { s.t = h; return power(s); });
  assert.ok(kw.every((x) => Math.abs(x - kw[0]) < 1e-6 * kw[0]), 'sem dia e noite');
  for (const g of GENERATORS) s.owned[g.id] = g.id === 'swarm' ? 0 : 400; // todas caras
  s.t = 30; // fechada
  assert.notEqual(cheapestGen(s)?.id, 'swarm');
});

test('aba Geradores: só as fontes do capítulo, com as teclas na ordem dele', () => {
  const s = newState();
  s.money = 1e15;
  s.techs.t_orbital = true;
  const { app, text } = make(s);
  assert.doesNotMatch(text(), /Enxame/, 'na Terra, o Enxame não existe');
  app.key('1');
  assert.ok(s.owned.wind > 0, 'na Terra, a tecla 1 é a eólica');
  s.chapter = 'solar';
  const t = text();
  assert.match(t, /\[1\] Enxame Orbital/);
  assert.match(t, /janela aberta|lançamento em/);
  assert.doesNotMatch(t, /\[1\] Turbina Eólica/);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  s.t = 0;
  app.key('1');
  assert.ok(s.owned.swarm > 0, 'no Sistema Solar, a tecla 1 compra o Enxame');
  app.state.t = 30;
  app.key('1');
  assert.match(text(), /próxima janela de lançamento abre em \d+ s/);
});

test('Kugelblitz: rende a fração de alimentação que as outras fontes dão; Acreção Controlada ajuda', () => {
  const s = newState();
  s.chapter = 'solar';
  const k = gen('kugelblitz');
  s.techs.t_kugel = true;
  s.owned.kugelblitz = 1;
  assert.equal(feedFactor(s, k), 0, 'sozinho, sem alimentação');
  assert.equal(power(s), 0);
  const share = k.traits.find((t) => t.type === 'feed').share;
  // Fonte estável (sem vento/sol) para a conta ficar exata: o Enxame.
  s.techs.t_orbital = true;
  const geo = gen('swarm');
  s.owned.swarm = 1;
  const expected = genPower(s, geo) / (share * k.output);
  assert.ok(expected > 0 && expected < 0.5);
  assert.ok(Math.abs(feedFactor(s, k) - expected) < 1e-9);
  assert.ok(Math.abs(genPower(s, k) - k.output * expected) < 1e-3, 'rende só a parte alimentada');
  s.techs.t_feed = true; // precisa de metade: rende o dobro
  assert.ok(Math.abs(feedFactor(s, k) - 2 * expected) < 1e-9);
  s.owned.swarm = 1e6;
  assert.equal(feedFactor(s, k), 1, 'nunca passa de 100%');
  s.owned.kugelblitz = 0;
  assert.equal(feedFactor(s, k), 1);
});

test('Energia do Vácuo: oscila entre x0.2 e x5; Volantes de Inércia sobem o piso e a média offline', () => {
  const s = newState();
  s.chapter = 'galaxy';
  const v = gen('vacuum');
  s.techs.t_vacuum = true;
  s.owned.vacuum = 1;
  let min = Infinity;
  let max = 0;
  for (let t = 0; t < 3000; t += 0.25) {
    s.t = t;
    const f = genEnv(s, v);
    min = Math.min(min, f);
    max = Math.max(max, f);
  }
  assert.ok(min >= 0.2 - 1e-9 && min < 0.25, `mín ${min}`);
  assert.ok(max <= 5 + 1e-9 && max > 4.5, `máx ${max}`);
  const avg = genEnv(s, v, true);
  assert.ok(avg > 1 && avg < 2, `média ${avg}`);
  s.techs.t_flywheel = true;
  for (let t = 0; t < 300; t += 0.5) { s.t = t; assert.ok(genEnv(s, v) >= 1); }
  assert.ok(genEnv(s, v, true) > avg, 'o piso sobe a média do offline');
});

test('Armazenamento: o excedente da rede vale mais; toda pesquisa tem descrição', async () => {
  const { sales, excessRate, capacity } = await import('../src/core/engine.js');
  const { GRID } = await import('../src/data/grid.js');
  const { TECHS } = await import('../src/data/research.js');
  const { describe } = await import('../src/ui/screens/research.js');
  const s = newState();
  const kw = capacity(s) * 3;
  const base = sales(s, kw).perSecond;
  assert.equal(excessRate(s), GRID.excessPriceRate);
  s.techs.t_storage = true;
  s.techs.t_storage2 = true;
  assert.ok(Math.abs(excessRate(s) - (GRID.excessPriceRate + 0.35)) < 1e-12);
  assert.ok(sales(s, kw).perSecond > base);
  for (const t of TECHS) assert.ok(describe(t).length > 0, `${t.id} sem descrição`);
});

test('traços dos capítulos: dia lunar, cargas, pulsos e expansão do universo', () => {
  const s = newState();
  s.chapter = 'solar';
  const he = gen('helium3');
  const lunar = he.traits[0];
  s.t = lunar.period / 4; // meio do dia lunar
  assert.ok(Math.abs(genEnv(s, he) - (lunar.floor + lunar.peak)) < 1e-9);
  s.t = (3 * lunar.period) / 4; // meio da noite
  assert.ok(Math.abs(genEnv(s, he) - lunar.floor) < 1e-9);
  s.techs.t_lunarnight = true;
  assert.ok(genEnv(s, he) > lunar.floor, 'Reservas Noturnas sobem o piso');

  const ast = gen('asteroids');
  const haul = ast.traits[0];
  s.t = haul.period - haul.window / 2;
  assert.equal(genEnv(s, ast), haul.boost, 'a carga chegando');
  s.t = 1;
  assert.equal(genEnv(s, ast), 1);
  s.techs.t_haul = true;
  assert.ok(genEnv(s, ast, true) > 1 + (haul.boost - 1) * haul.window / haul.period, 'Rebocadores alargam a janela');

  const g = newState();
  g.chapter = 'galaxy';
  const dark = gen('darkenergy');
  const ex = dark.traits[0];
  assert.equal(genEnv(g, dark), 1);
  g.stats.playTime = ex.hour;
  assert.equal(genEnv(g, dark), 2, 'uma hora de partida: x2');
  g.stats.playTime = 1e9;
  assert.equal(genEnv(g, dark), ex.cap);
  assert.equal(genEnv(g, dark, true), ex.cap, 'offline vale o ponto da partida');
  const pul = gen('pulsar');
  const p = pul.traits[0];
  g.t = p.period - 0.5;
  assert.equal(genEnv(g, pul), p.boost);
});
