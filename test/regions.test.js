import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { REGIONS, REGION_RULES } from '../src/data/regions.js';
import { capacity, priceBase, power } from '../src/core/engine.js';
import { expandRegion, expandCost, canExpand } from '../src/core/actions.js';
import { autoStep } from '../src/core/automation.js';
import { regionName, nextRegion } from '../src/core/regions.js';

test('regiões: expandir pede a produção que a região consome e dinheiro; sobe a demanda e o kWh', () => {
  const s = newState();
  assert.equal(regionName(s), 'Bairro');
  assert.equal(canExpand(s), false, 'sem produção não expande');
  s.techs.t_geo = true;
  s.owned.geothermal = 10;
  assert.ok(power(s) >= REGIONS.earth[1].need);
  assert.equal(canExpand(s), true);
  const cap = capacity(s);
  const price = priceBase(s);
  const cost = expandCost(s);
  assert.ok(Math.abs(cost - REGIONS.earth[1].need * price * REGION_RULES.costSeconds) < 1e-6, 'custa a renda de quem produz o que a Cidade pede');
  assert.equal(expandRegion(s), false, 'sem dinheiro');
  s.money = cost;
  assert.ok(expandRegion(s));
  assert.equal(s.money, 0);
  assert.equal(regionName(s), 'Cidade');
  assert.ok(Math.abs(capacity(s) / cap - REGIONS.earth[1].base / REGIONS.earth[0].base) < 1e-9);
  assert.ok(Math.abs(priceBase(s) / price - (1 + REGION_RULES.pricePerRegion)) < 1e-9);
  assert.equal(s.stats.expansions, 1);
  s.region = REGIONS.earth.length - 1;
  assert.equal(nextRegion(s), null);
  assert.equal(canExpand(s), false, 'Planeta é a última região da Terra');
});

test('Concessões Automáticas expandem sozinhas quando dá', () => {
  const s = newState();
  s.techs.t_geo = true;
  s.owned.geothermal = 10;
  s.money = 1e12;
  autoStep(s, 1);
  assert.equal(s.region, 0, 'sem a pesquisa, nada');
  s.techs.t_autoregion = true;
  autoStep(s, 1);
  assert.equal(s.region, 1);
});

test('save v12 migra para v13: a região cobre a capacidade que as pesquisas antigas davam', () => {
  const mk = (techs) => {
    const st = JSON.parse(JSON.stringify(newState()));
    st.techs = Object.fromEntries(techs.map((id) => [id, true]));
    return fromSave(migrate({ saveVersion: 12, savedAt: 1, state: st }).state);
  };
  assert.equal(SAVE_VERSION, 13);
  assert.equal(mk([]).region, 0);
  // Linhas de Alta Tensão: 150 × 20 = 3k kW antes; agora Cidade (5k) × 3 cobre.
  assert.equal(mk(['t_hv']).region, 1);
  const all = mk(['t_hv', 't_substation', 't_hvdc', 't_continental', 't_planetary', 't_orbitalgrid']);
  assert.equal(all.region, 6, 'tudo pesquisado: o Planeta');
  assert.ok(isValidState(all));
  assert.equal(isValidState({ ...all, region: 99 }), false);
});

test('aba Rede: N expande com mensagem; o cabeçalho mostra a região', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi, visibleLength } = await import('../src/ui/format.js');
  const s = newState();
  s.techs.t_geo = true;
  s.owned.geothermal = 10;
  s.events.next = 1e9;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.key('r');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  assert.match(text(), /Bairro \d+%|Bairro >999%/);
  assert.match(text(), /\[N\] expandir para Cidade: \$/);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  app.key('n');
  assert.match(text(), /Faltam \$/);
  s.money = 1e12;
  app.key('n');
  assert.equal(s.region, 1);
  assert.match(text(), /agora você atende Cidade/);
  assert.match(stripAnsi(app.lines(80, 24)[2]), /Cidade /);
});

test('save v12 com a Fronteira na Terra: o que era dela vai para o estoque, e o save fica válido', () => {
  const st = JSON.parse(JSON.stringify(newState()));
  delete st.chapter;
  delete st.empire;
  Object.assign(st.owned, { swarm: 40, kugelblitz: 12, vacuum: 3, antimatter: 50 });
  Object.assign(st.upgrades, { swarm: 3, vacuum: 1 });
  st.techs = { t_antimatter: true, t_orbital: true, t_kugel: true, t_vacuum: true, t_flywheel: true, t_global3: true, t_lab: true };
  st.wear.broken = [{ gen: 'swarm', at: 1 }, { gen: 'wind', at: 1 }];
  const s = fromSave(migrate({ saveVersion: 12, savedAt: 1, state: st }).state);
  assert.ok(isValidState(s));
  assert.equal(s.chapter, 'earth');
  for (const id of ['swarm', 'kugelblitz', 'vacuum']) assert.equal(s.owned[id], 0, id);
  assert.equal(s.owned.antimatter, 50, 'a Terra fica como estava');
  assert.ok(s.techs.t_antimatter && s.techs.t_lab);
  assert.ok(!s.techs.t_orbital && !s.techs.t_vacuum && !s.techs.t_global3);
  assert.deepEqual(s.wear.broken.map((b) => b.gen), ['wind']);
  const stash = s.empire.frontierStash;
  assert.deepEqual(stash.owned, { swarm: 40, kugelblitz: 12, vacuum: 3 });
  assert.deepEqual(stash.upgrades, { swarm: 3, kugelblitz: 0, vacuum: 1 });
  assert.deepEqual(stash.techs.sort(), ['t_flywheel', 't_global3', 't_kugel', 't_orbital', 't_vacuum']);
  // Sem Fronteira, sem estoque.
  const plain = fromSave(migrate({ saveVersion: 12, savedAt: 1, state: JSON.parse(JSON.stringify(newState())) }).state);
  assert.equal(plain.empire.frontierStash, null);
  assert.equal(isValidState({ ...plain, chapter: 'marte' }), false);
});

test('capítulos: fontes e pesquisas só existem no seu capítulo; a ascensão mantém o capítulo', async () => {
  const { genUnlocked, techVisible, chapterTechs } = await import('../src/core/engine.js');
  const { GENERATORS } = await import('../src/data/generators.js');
  const { TECHS } = await import('../src/data/research.js');
  const { ascend, minRunEarned } = await import('../src/core/prestige.js');
  const s = newState();
  const swarm = GENERATORS.find((g) => g.id === 'swarm');
  const orbital = TECHS.find((t) => t.id === 't_orbital');
  s.techs.t_orbital = true;
  assert.equal(genUnlocked(swarm, s), false, 'Enxame não existe na Terra');
  delete s.techs.t_orbital;
  assert.equal(techVisible(orbital, s), false);
  s.chapter = 'solar';
  assert.equal(techVisible(orbital, s), true, 'raiz do Sistema Solar');
  assert.ok(chapterTechs(s).some((t) => t.id === 't_lab'), 'pesquisas gerais valem em todo capítulo');
  assert.ok(!chapterTechs(s).some((t) => t.id === 't_solar'), 'as da Terra não');
  s.region = 5;
  s.earned = minRunEarned(s);
  assert.ok(minRunEarned(s) > 1e20, 'o mínimo acompanha a escala do capítulo');
  assert.ok(ascend(s) > 0);
  assert.equal(s.chapter, 'solar');
  assert.equal(s.region, 0);
});
