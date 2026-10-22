import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZE, GENERATORS } from '../src/data/generators.js';
import { CHAPTERS, chapterIndex } from '../src/data/chapters.js';
import { TECHS } from '../src/data/research.js';
import { GRID } from '../src/data/grid.js';
import { newState } from '../src/core/state.js';
import {
  power, genEnv, upkeep, income, tick, applyOffline, genUnlocked, sales,
} from '../src/core/engine.js';
import { buyGen, buyTech } from '../src/core/actions.js';
import { TRAITS, windLevel, sunLevel, hourOfDay, isDay, START_HOUR } from '../src/core/traits.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);

// Amostra um fator ao longo de muitas horas de jogo: [mínimo, máximo, média].
function sample(fn, hours = 20000, step = 0.25) {
  let min = Infinity; let max = -Infinity; let sum = 0; let n = 0;
  const s = newState();
  for (let t = 0; t < hours; t += step) {
    s.t = t;
    const v = fn(s);
    min = Math.min(min, v); max = Math.max(max, v); sum += v; n++;
  }
  return [min, max, sum / n];
}

test('dados: ids únicos, tecla pela posição na página, desbloqueios e pré-requisitos existem', () => {
  assert.equal(new Set(GENERATORS.map((g) => g.id)).size, GENERATORS.length);
  // Uma página por capítulo, no máximo PAGE_SIZE fontes; teclas 1..9 e 0 na ordem.
  for (const c of CHAPTERS) {
    const list = GENERATORS.filter((g) => g.chapter === c.id);
    assert.ok(list.length <= PAGE_SIZE, c.id);
    list.forEach((g, i) => {
      assert.equal(g.page, chapterIndex(c.id), g.id);
      assert.equal(g.key, String((i + 1) % 10), `${g.id}: tecla fora de ordem`);
    });
  }
  // Pesquisas: nenhum requisito cruza capítulos; fonte e a pesquisa que a libera no mesmo.
  const byId = new Map(TECHS.map((x) => [x.id, x]));
  for (const t of TECHS) {
    for (const r of t.req) {
      const req = byId.get(r);
      assert.ok(!req.chapter || req.chapter === t.chapter, `${t.id} (${t.chapter ?? 'geral'}) pede ${r} (${req.chapter})`);
    }
  }
  for (const g of GENERATORS.filter((x) => x.unlock)) assert.equal(byId.get(g.unlock).chapter, g.chapter, g.id);
  const techIds = new Set(TECHS.map((t) => t.id));
  for (const g of GENERATORS) {
    assert.ok(g.unlock === null || techIds.has(g.unlock), `${g.id}: unlock inexistente`);
    assert.ok(g.art, `${g.id}: sem art`);
    for (const tr of g.traits) assert.ok(TRAITS[tr.type] || ['upkeep', 'heat'].includes(tr.type), `${g.id}: trait ${tr.type}`);
  }
  for (const t of TECHS) for (const r of t.req) assert.ok(techIds.has(r), `${t.id}: req ${r}`);
  for (const t of TECHS.filter((x) => x.type === 'unlock')) {
    assert.ok(GENERATORS.some((g) => g.unlock === t.id), `${t.id} não destrava nada`);
  }
});

test('custo de operação nunca supera a receita mínima, nem com a rede saturada', () => {
  // Pior caso: preço no mínimo (0.8) e toda a energia vendida como excedente.
  for (const g of GENERATORS) {
    const up = g.traits.filter((tr) => tr.type === 'upkeep').reduce((a, tr) => a + tr.money, 0);
    const floor = g.output * 0.8 * GRID.excessPriceRate;
    assert.ok(up < floor, `${g.id}: upkeep ${up} >= ${floor}`);
  }
});

test('novas fontes ficam bloqueadas até a pesquisa', () => {
  const s = newState();
  s.money = 1e12;
  s.rp = 1e9;
  for (const id of ['biomass', 'geothermal', 'tidal', 'antimatter']) {
    assert.equal(genUnlocked(gen(id), s), false);
    assert.equal(buyGen(s, id), false);
  }
  for (const t of ['t_solar', 't_hydro', 't_biomass', 't_gas', 't_geo', 't_nuclear', 't_tidal', 't_fusion', 't_antimatter']) {
    assert.ok(buyTech(s, t), t);
  }
  for (const id of ['biomass', 'geothermal', 'tidal', 'antimatter']) assert.ok(buyGen(s, id), id);
});

test('vento: fica entre 0.6 e 1.4 e tem média ≈ 1', () => {
  const [min, max, avg] = sample(windLevel);
  assert.ok(min >= 0.6 && max <= 1.4);
  assert.ok(max - min > 0.5, 'o vento precisa variar de verdade');
  assert.ok(Math.abs(avg - 1) < 0.03, `média ${avg}`);
});

test('solar: dia/noite, começa de dia, média bate com avg(), baterias sobem a noite', () => {
  const s = newState();
  assert.equal(hourOfDay(s), START_HOUR);
  assert.ok(isDay(s));
  const solar = gen('solar');
  s.t = 24 - START_HOUR; // meia-noite
  assert.equal(sunLevel(s), 0);
  const night = genEnv(s, solar);
  assert.ok(Math.abs(night - 0.15) < 1e-9);
  s.techs.t_battery = true;
  assert.ok(Math.abs(genEnv(s, solar) - 0.5) < 1e-9);
  delete s.techs.t_battery;
  s.t = 12 - START_HOUR; // meio-dia
  assert.ok(Math.abs(genEnv(s, solar) - (0.15 + 2.6)) < 1e-9);
  const [, , avg] = sample((x) => genEnv(x, solar), 24 * 50, 0.05);
  assert.ok(Math.abs(avg - genEnv(newState(), solar, true)) < 0.01, `média ${avg}`);
});

test('maré e reservatório: faixas e médias', () => {
  const tidal = gen('tidal');
  const hydro = gen('hydro');
  const [tmin, tmax, tavg] = sample((s) => genEnv(s, tidal));
  assert.ok(tmin >= 0.5 - 1e-9 && tmax <= 1.5 + 1e-9 && Math.abs(tavg - 1) < 0.01);
  const [hmin, hmax, havg] = sample((s) => genEnv(s, hydro), 720 * 20, 1);
  assert.ok(hmin >= 0.9 - 1e-9 && hmax <= 1.2 + 1e-9);
  assert.ok(Math.abs(havg - genEnv(newState(), hydro, true)) < 0.01);
});

test('fontes estáveis não variam', () => {
  for (const id of ['biomass', 'geothermal', 'nuclear', 'gas', 'fusion', 'antimatter']) {
    const [min, max] = sample((s) => genEnv(s, gen(id)), 100, 0.5);
    assert.equal(min, 1);
    assert.equal(max, 1);
  }
});

test('custo de operação: entra na renda líquida e é descontado no tick', () => {
  const s = newState();
  s.owned.gas = 2;
  s.owned.fusion = 1;
  assert.equal(upkeep(s), 2 * 120 + 11000);
  assert.ok(Math.abs(income(s) - (sales(s, power(s)).perSecond - upkeep(s))) < 1e-9);
  const expected = sales(s, power(s)).perSecond - upkeep(s);
  tick(s, 1);
  assert.ok(Math.abs(s.money - expected) < 1e-6);
  assert.ok(s.money > 0);
});

test('offline usa as médias: sair à noite ou ao meio-dia rende o mesmo', () => {
  const at = (hour) => {
    const s = newState();
    s.owned.solar = 10; s.owned.wind = 10; s.owned.tidal = 1;
    s.t = hour - START_HOUR + 24;
    return applyOffline(s, 3600).energy;
  };
  assert.ok(Math.abs(at(0) - at(12)) < 1e-6);
  assert.ok(at(0) > 0);
});
