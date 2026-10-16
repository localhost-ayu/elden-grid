import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { LEGACY, SHOP } from '../src/data/legacy.js';
import {
  pointsFor, legacyGain, canAscend, nextPointIn, legacyMult, buyShop, ascend, shopLevel,
} from '../src/core/prestige.js';
import { power, genCost, rpRate, tick, applyOffline } from '../src/core/engine.js';
import { crank } from '../src/core/actions.js';
import { autoInterval } from '../src/core/automation.js';
import { createApp } from '../src/ui/app.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

const D = LEGACY.divisor;

function ready() {
  const s = newState();
  s.earned = LEGACY.minRunEarned;
  return s;
}

test('fórmula: raiz do dinheiro ganho em todas as partidas, menos o já recebido', () => {
  assert.equal(pointsFor(0), 0);
  assert.equal(pointsFor(D), 1);
  assert.equal(pointsFor(4 * D - 1), 1);
  assert.equal(pointsFor(4 * D), 2);
  const s = newState();
  s.earned = 9 * D;
  assert.equal(legacyGain(s), 3);
  s.legacy.earned = 2;
  assert.equal(legacyGain(s), 1);
  s.legacy.lifetime = 7 * D; // 16 D no total -> 4 pontos
  assert.equal(legacyGain(s), 2);
  assert.equal(nextPointIn(s), 25 * D - 16 * D);
});

test('ascensão exige o mínimo ganho na partida e ao menos 1 ponto', () => {
  const s = newState();
  s.earned = LEGACY.minRunEarned - 1;
  assert.equal(canAscend(s), false);
  assert.equal(ascend(s), 0);
  s.earned = LEGACY.minRunEarned;
  assert.equal(canAscend(s), true);
  s.legacy.earned = legacyGain(s) + s.legacy.earned; // já recebeu tudo
  assert.equal(canAscend(s), false);
});

test('ganho é rastreado no tick e na manivela, e gastar não desconta', () => {
  const s = newState();
  s.owned.wind = 10;
  tick(s, 10);
  const afterTick = s.earned;
  assert.ok(afterTick > 0 && Math.abs(afterTick - s.money) < 1e-9);
  crank(s);
  assert.ok(s.earned > afterTick);
  s.money = 0; // gastou tudo
  assert.ok(s.earned > afterTick);
});

test('ascender zera a partida e mantém o Legado', () => {
  const s = ready();
  Object.assign(s, { money: 5e9, rp: 300, labs: 4, transformers: 2, t: 999 });
  s.owned.wind = 80;
  s.techs.t_solar = true;
  s.upgrades.wind = 3;
  s.legacy.shop.goldcrank = 1;
  const before = s.legacy.ascensions;
  const gain = ascend(s);
  assert.equal(gain, pointsFor(LEGACY.minRunEarned));
  assert.equal(s.money, 0);
  assert.equal(s.rp, 0);
  assert.equal(s.labs, 0);
  assert.equal(s.owned.wind, 0);
  assert.deepEqual(s.techs, {});
  assert.equal(s.upgrades.wind, 0);
  assert.equal(s.transformers, 0);
  assert.equal(s.t, 0);
  assert.equal(s.earned, 0);
  assert.equal(s.legacy.points, gain);
  assert.equal(s.legacy.earned, gain);
  assert.equal(s.legacy.lifetime, LEGACY.minRunEarned);
  assert.equal(s.legacy.ascensions, before + 1);
  assert.equal(s.legacy.shop.goldcrank, 1);
  assert.ok(isValidState(s));
});

test('cada ponto não gasto dá +10% de produção; gastar troca bônus por vantagem', () => {
  const s = newState();
  s.owned.wind = 10;
  const base = power(s);
  s.legacy.points = 5;
  assert.ok(Math.abs(legacyMult(s) - 1.5) < 1e-12);
  assert.ok(Math.abs(power(s) - base * 1.5) < 1e-9);
  assert.equal(buyShop(s, 'contracts'), true);
  assert.equal(s.legacy.points, 2);
  assert.ok(power(s) < base * 1.5);
});

test('loja: custo por nível, sem pontos não compra, nível máximo trava', () => {
  const s = newState();
  const item = SHOP.find((x) => x.id === 'heirloom');
  assert.equal(buyShop(s, 'heirloom'), false);
  s.legacy.points = 10;
  assert.equal(buyShop(s, 'heirloom'), true);
  assert.equal(s.legacy.points, 10 - item.costs[0]);
  assert.equal(buyShop(s, 'heirloom'), false); // só 1 nível
  assert.equal(shopLevel(s, item), 1);
  assert.equal(buyShop(s, 'nada'), false);
});

test('efeitos da loja: custo, pesquisa, manivela, offline, auto-compra e começo', () => {
  const s = newState();
  s.labs = 2;
  const wind = { id: 'wind', baseCost: 15, growth: 1.15, traits: [], output: 1 };
  const cost0 = genCost(s, wind);
  const rp0 = rpRate(s);
  s.legacy.shop = { contracts: 3, grants: 1, goldcrank: 3, nightshift: 2, heirloom: 1, start: 2 };
  assert.equal(genCost(s, wind), Math.ceil(15 * 0.7));
  assert.ok(cost0 > genCost(s, wind));
  assert.equal(rpRate(s), rp0 * 1.5);
  s.owned.wind = 10;
  assert.equal(crank(s), power(s) * 5);
  const r = applyOffline(s, 10 * 3600);
  assert.equal(r.counted, 4 * 3600);
  assert.equal(r.rate, 0.7);
  assert.equal(autoInterval(s), 1);
  s.earned = LEGACY.minRunEarned;
  ascend(s);
  assert.equal(s.owned.wind, 25);
  assert.equal(s.auto.buy, true);
});

test('save v5 migra para v6 com o saldo como ganho mínimo e Legado vazio', () => {
  const v5 = { saveVersion: 5, savedAt: 1, state: { ...newState(), money: 1234 } };
  delete v5.state.earned;
  delete v5.state.legacy;
  const env = migrate(v5);
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.equal(s.earned, 1234);
  assert.deepEqual(s.legacy, newState().legacy);
  assert.ok(isValidState(s));
  assert.equal(isValidState({ ...s, legacy: { ...s.legacy, points: -1 } }), false);
  assert.equal(isValidState({ ...s, earned: NaN }), false);
});

function make(state) {
  const slots = { 1: { status: 'ok', savedAt: null, state } };
  const saves = [];
  const store = {
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })),
    load: (n) => slots[n],
    save: (n, st) => { saves.push(structuredClone(st)); return true; },
    remove() {},
  };
  const calls = { quit: 0 };
  const app = createApp({ store, now: 0, onQuit: () => calls.quit++ });
  app.key('1');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, text, saves, calls };
}

test('aba Legado: prévia, confirmação S/N que segura as teclas, e ascensão salva', () => {
  const { app, text, saves, calls } = make(ready());
  assert.match(text(), /Legado✦/); // aviso na barra de abas
  app.key('l');
  assert.match(text(), /Ascender agora: \+5 pontos/);
  app.key('enter');
  assert.match(text(), /Ascender por \+5 pontos\?.*\(S\/N\)/);
  assert.match(text(), /S confirmar/);
  app.key('m');
  app.key('q');
  assert.equal(app.mode, 'game'); // não fugiu para o menu
  assert.equal(calls.quit, 0);
  app.key('n');
  assert.equal(app.state.legacy.ascensions, 0);
  app.key('enter');
  app.key('S');
  assert.equal(app.state.legacy.ascensions, 1);
  assert.equal(app.state.legacy.points, 5);
  assert.equal(saves.at(-1).legacy.ascensions, 1);
  assert.match(text(), /Ascensão 1! \+5 pontos/);
  assert.match(text(), /✦ \+50%/); // bônus no cabeçalho
});

test('aba Legado: compra na loja e mensagens; cabe em 80×24', () => {
  const s = newState();
  s.legacy.points = 1;
  const { app, text } = make(s);
  app.key('l');
  app.key('enter');
  assert.match(text(), /disponível após ganhar/);
  app.key('down');
  app.key('enter');
  assert.match(text(), /Falta 1 ponto para Começo Rápido/);
  for (let i = 0; i < 3; i++) app.key('down'); // Turno da Noite custa 1
  app.key('enter');
  assert.match(text(), /Turno da Noite nível 1/);
  assert.equal(app.state.legacy.points, 0);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, l);
  app.key('enter');
  assert.match(text(), /Faltam 3 pontos para Turno da Noite/);
});

test('loja do legado rola sob o cabeçalho fixo e mantém a seleção à vista', async () => {
  const legacyScreen = await import('../src/ui/screens/legacy.js');
  const s = newState();
  const ui = {};
  const ctx = { state: s, ui, say() {} };
  const plain = (h) => legacyScreen.render(ctx, h).map(stripAnsi);
  const full = plain(Infinity);
  assert.equal(full.filter((l) => SHOP.some((it) => l.includes(it.name))).length, SHOP.length);
  const tight = plain(10); // cabeçalho de 7 linhas: 2 itens + indicador
  assert.equal(tight.length, 10);
  assert.match(tight.at(-1), /itens 1–2 de \d+/);
  for (let i = 0; i < SHOP.length; i++) legacyScreen.key(ctx, 'down');
  const end = plain(10);
  assert.ok(end.some((l) => l.includes('›') && l.includes(SHOP.at(-1).name)), 'último item selecionado e visível');
  assert.match(end.at(-1), new RegExp(`itens ${SHOP.length - 1}–${SHOP.length} de ${SHOP.length}`));
  for (let i = 0; i < SHOP.length; i++) legacyScreen.key(ctx, 'up');
  assert.match(plain(10)[3], /› ✦ Ascender/);
});

test('loja 1.1: listas de Pesquisa Herdada incluem seus pré-requisitos e crescem por nível', async () => {
  const { TECHS } = await import('../src/data/research.js');
  const item = SHOP.find((x) => x.type === 'techs');
  let prev = [];
  for (const list of item.values) {
    for (const id of list) {
      const t = TECHS.find((x) => x.id === id);
      assert.ok(t, id);
      for (const r of t.req) assert.ok(list.includes(r), `${id} precisa de ${r}`);
    }
    assert.ok(prev.every((id) => list.includes(id)));
    prev = list;
  }
  for (const it of SHOP) {
    assert.equal(it.costs.length, it.values.length, it.id);
    assert.ok(it.costs.every((c, i) => i === 0 || c > it.costs[i - 1]), `${it.id}: custos crescentes`);
  }
});

test('loja 1.1: a partida começa com pesquisas, resfriamento, transformadores e auto-compra', () => {
  const s = ready();
  s.legacy.shop = { research: 3, thermal: 2, inherited: 3, start: 4 };
  ascend(s);
  for (const id of ['t_wind2', 't_hydro', 't_auto', 't_substation']) assert.equal(s.techs[id], true, id);
  assert.equal(s.cooling.nuclear, 2);
  assert.equal(s.cooling.antimatter, 2);
  assert.equal(s.transformers, 3);
  assert.equal(s.owned.wind, 100);
  assert.equal(s.auto.buy, true); // t_auto veio pronta
  assert.equal(s.stats.techs, 0); // herdado não conta como pesquisado
  assert.ok(isValidState(s));
});

test('loja 1.1: Marcos Antecipados baixam a exigência; Seguro de Rede barateia as crises', async () => {
  const { milestones, genModMult } = await import('../src/core/engine.js');
  const { GENERATORS } = await import('../src/data/generators.js');
  const { damage } = await import('../src/core/incidents.js');
  const { buyGenBulk } = await import('../src/core/actions.js');
  const s = newState();
  assert.deepEqual(milestones(s).map((m) => m.at), [25, 50, 100]);
  s.legacy.shop.early = 2;
  assert.deepEqual(milestones(s).map((m) => m.at), [15, 30, 60]);
  s.money = 1e9;
  buyGenBulk(s, 'wind', 15);
  assert.equal(s.stats.milestones, 1);
  assert.equal(genModMult(s, GENERATORS[0], 'output'), 2);

  s.owned.wind = 100;
  const full = damage(s);
  assert.ok(full > 0);
  s.legacy.shop.insurance = 2;
  assert.ok(Math.abs(damage(s) - full * 0.5) < 1e-9);
  s.legacy.shop.insurance = 3;
  assert.equal(damage(s), 0);
});
