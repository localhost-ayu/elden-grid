import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState } from '../src/core/state.js';
import { COLONIZE, COLONY, PATENT_TREE } from '../src/data/empire.js';
import { REGIONS } from '../src/data/regions.js';
import { canColonize, colonize, colonizeStatus, patentGain, veteran, buyPatent, treeLevel } from '../src/core/empire.js';
import { power, techCost, tick } from '../src/core/engine.js';
import { TECHS } from '../src/data/research.js';

// Terra pronta para colonizar: a última região e os pontos do capítulo.
function ready() {
  const s = newState();
  s.region = REGIONS.earth.length - 1;
  s.legacy.earned = COLONIZE.earth.points;
  s.legacy.points = 50;
  s.legacy.ascensions = 7;
  s.legacy.shop.start = 2;
  s.legacy.monument = 3;
  s.career.playTime = 1000;
  s.achievements.a_mwh = 1;
  return s;
}

test('colonizar pede a última região e os pontos do capítulo; reinicia o legado e dá Patentes', () => {
  const s = ready();
  s.region--;
  assert.equal(canColonize(s), false);
  assert.deepEqual(colonizeStatus(s).map((c) => c.done), [false, true]);
  s.region++;
  assert.equal(canColonize(s), true);
  const gain = patentGain(s);
  assert.ok(gain > 0);
  const r = colonize(s);
  assert.equal(r.chapter, 'Sistema Solar');
  assert.equal(s.chapter, 'solar');
  assert.equal(s.empire.patents, gain);
  assert.deepEqual(s.empire.colonies.map((c) => c.chapter), ['earth']);
  assert.deepEqual([s.legacy.points, s.legacy.earned, s.legacy.ascensions, s.legacy.monument], [0, 0, 0, 0]);
  assert.deepEqual(s.legacy.shop, {});
  assert.equal(s.career.playTime, 1000, 'a carreira fica');
  assert.equal(s.achievements.a_mwh, 1, 'as conquistas ficam');
  assert.equal(s.owned.swarm, 1, 'começa com 1 Enxame');
  assert.ok(s.techs.t_orbital);
  assert.equal(s.region, 0);
  assert.ok(isValidState(s));
  // Sem próximo capítulo depois da Galáxia.
  s.chapter = 'galaxy';
  s.region = REGIONS.galaxy.length - 1;
  s.legacy.earned = 1e6;
  assert.equal(canColonize(s), false);
  assert.equal(colonize(s), null);
});

test('colônias: x2 na produção cada e Patentes por hora; Patentes compram a árvore', () => {
  const s = ready();
  colonize(s);
  const base = power(s);
  s.empire.colonies = [];
  assert.ok(Math.abs(base / power(s) - COLONY.mult) < 1e-9);
  s.empire.colonies = [{ chapter: 'earth', at: 0 }];
  const p = s.empire.patents;
  tick(s, 3600, true);
  assert.ok(Math.abs(s.empire.patents - p - COLONY.perHour) < 1e-9);
  // Árvore: Arquivo barateia a pesquisa; Produção Imperial multiplica.
  s.empire.patents = 1000;
  const t = TECHS.find((x) => x.id === 't_swarm2');
  const cost = techCost(s, t);
  assert.ok(buyPatent(s, 'archive'));
  assert.ok(techCost(s, t) < cost);
  const before = power(s);
  assert.ok(buyPatent(s, 'imperial'));
  assert.ok(Math.abs(power(s) / before - PATENT_TREE.find((x) => x.id === 'imperial').values[0]) < 1e-9);
  assert.equal(treeLevel(s, PATENT_TREE.find((x) => x.id === 'imperial')), 1);
  s.empire.patents = 0;
  assert.equal(buyPatent(s, 'imperial'), false);
});

test('Legado Fundador e Capital Inicial valem no capítulo novo', () => {
  const s = ready();
  s.empire.patents = 100;
  buyPatent(s, 'founder');
  buyPatent(s, 'capital');
  colonize(s);
  assert.equal(s.legacy.points, PATENT_TREE.find((x) => x.id === 'founder').values[0]);
  assert.ok(s.money > 0, 'Capital Inicial');
});

test('veterano da 1.x coloniza direto e recebe a Herança da Fronteira', () => {
  const st = JSON.parse(JSON.stringify(newState()));
  delete st.chapter;
  delete st.empire;
  Object.assign(st.owned, { swarm: 40, kugelblitz: 12, vacuum: 3 });
  Object.assign(st.upgrades, { swarm: 3 });
  st.techs = { t_orbital: true, t_swarm2: true, t_vacuum: true };
  const s = fromSave(migrate({ saveVersion: 12, savedAt: 1, state: st }).state);
  assert.ok(veteran(s));
  assert.ok(canColonize(s), 'sem repetir a Terra');
  const r = colonize(s);
  assert.equal(r.inherited, true);
  assert.equal(s.owned.swarm, 40);
  assert.equal(s.owned.kugelblitz, 12);
  assert.equal(s.upgrades.swarm, 3);
  assert.ok(s.techs.t_swarm2);
  assert.deepEqual(s.empire.frontierStash.owned, { vacuum: 3 }, 'o Vácuo espera a Galáxia');
  assert.ok(isValidState(s));
});

test('aba Legado, Império: I abre, C coloniza com S/N, Enter compra na árvore; cabe em 80×24', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi, visibleLength } = await import('../src/ui/format.js');
  const s = ready();
  s.events.next = 1e9;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.key('l');
  app.key('i');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  assert.match(text(), /Império · Terra/);
  assert.match(text(), /Colonizar: Sistema Solar/);
  assert.match(text(), /\[C\] colonizar: \+\d+ Patentes/);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  app.key('c');
  assert.match(text(), /Colonizar Sistema Solar\? .*\(S\/N\)/);
  app.key('s');
  assert.equal(app.state.chapter, 'solar');
  assert.match(text(), /Colonização: Sistema Solar!/);
  assert.match(text(), /Novo capítulo, legado zerado: ascenda ao atender Marte\./);
  assert.match(text(), /Império · Sistema Solar/);
  app.state.empire.patents = 10;
  app.key('enter');
  assert.equal(app.state.empire.tree.capital, 1);
  app.key('i');
  assert.match(text(), /Loja do Legado/);
});

test('conquistas de regiões e Kardashev: valem no capítulo e ficam para trás ao avançar', async () => {
  const { checkAchievements } = await import('../src/core/achievements.js');
  const s = newState();
  s.region = 4;
  let got = checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('k_city') && got.includes('k_country'));
  assert.ok(!got.includes('k_planet'));
  const t = newState();
  t.chapter = 'solar';
  t.region = 2;
  t.owned.swarm = 1;
  got = checkAchievements(t).map((a) => a.id);
  for (const id of ['k_city', 'k_country', 'k_planet', 'k_mars']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('k_sun'));
});

test('fim do jogo: Kardashev 3.0 avisa uma vez e o jogo segue', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi } = await import('../src/ui/format.js');
  const s = newState();
  s.chapter = 'galaxy';
  s.owned.darkenergy = 1e13; // muito acima de 4×10^34 kW
  s.events.next = 1e9;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.update(0.1, 100);
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  assert.match(text(), /Kardashev 3\.0: uma civilização Tipo III/);
  assert.equal(s.empire.ended, true);
  assert.ok(s.achievements.k_k3);
  assert.ok(isValidState(s));
});
