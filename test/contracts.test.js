import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, fromSave, isValidState } from '../src/core/state.js';
import { CONTRACT_RULES } from '../src/data/contracts.js';
import { contractsStep, accept, abandon, progress, greenShare, holdContracts } from '../src/core/contracts.js';
import { tick } from '../src/core/engine.js';

// Partida simples com produção estável (geotérmica não oscila) e renda.
function base() {
  const s = newState(3);
  s.techs.t_geo = true;
  s.owned.geothermal = 5;
  s.owned.wind = 5;
  s.stats.playTime = CONTRACT_RULES.firstAt;
  s.events.next = 1e9;
  return s;
}
const offer = (s, type) => {
  for (let i = 0; i < 200 && !s.market.contracts.offers.some((o) => o.type === type); i++) {
    s.market.contracts.offers = [];
    s.market.contracts.next = 0;
    contractsStep(s);
  }
  return s.market.contracts.offers.findIndex((o) => o.type === type);
};

test('contratos: ofertas chegam no ritmo, até 3, e somem se ninguém aceitar', () => {
  const s = base();
  s.stats.playTime = 0;
  assert.deepEqual(contractsStep(s), [], 'nada no começo da partida');
  s.stats.playTime = CONTRACT_RULES.firstAt;
  const notes = contractsStep(s);
  assert.equal(notes[0].type, 'offer');
  for (let i = 0; i < 10; i++) { s.t += CONTRACT_RULES.every; contractsStep(s); }
  assert.ok(s.market.contracts.offers.length <= CONTRACT_RULES.offers);
  s.t += CONTRACT_RULES.expires + 1;
  s.market.contracts.next = Infinity;
  contractsStep(s);
  assert.equal(s.market.contracts.offers.length, 0);
});

test('contrato de entrega: produzir a meta no prazo paga a recompensa; um ativo por vez', () => {
  const s = base();
  const i = offer(s, 'delivery');
  assert.ok(i >= 0);
  const o = s.market.contracts.offers[i];
  assert.ok(accept(s, i));
  assert.equal(accept(s, 0), false, 'só um contrato ativo');
  const money = s.money;
  const rp = s.rp;
  // Produção turbinada (mais usinas) para bater a meta antes do prazo.
  s.owned.geothermal = 50;
  let notes = [];
  for (let k = 0; k < o.duration * 10 && !notes.some((n) => n.type === 'won'); k++) { tick(s, 0.1); notes = contractsStep(s); }
  assert.ok(notes.some((n) => n.type === 'won'), 'cumpriu');
  assert.ok(s.money > money || s.rp > rp, 'recebeu');
  assert.equal(s.market.contracts.done, 1);
  assert.equal(s.market.contracts.active, null);
});

test('contrato de entrega sem esforço extra perde no prazo, sem multa', () => {
  const s = base();
  const i = offer(s, 'delivery');
  accept(s, i);
  const a = s.market.contracts.active;
  let notes = [];
  for (let k = 0; k < a.duration * 10 + 5 && !notes.length; k++) { tick(s, 0.1); notes = contractsStep(s).filter((n) => n.type !== 'offer'); }
  assert.equal(notes[0].type, 'lost');
  assert.equal(s.market.contracts.failed, 1);
  assert.ok(s.money >= 0);
});

test('contrato verde: cai abaixo da meta e falha; firme: um desligamento e falha', () => {
  const s = base();
  s.techs.t_gas = true;
  s.owned.gas = 3;
  const i = offer(s, 'green');
  assert.ok(i >= 0, 'há o que segurar (gás)');
  accept(s, i);
  assert.ok(greenShare(s) < s.market.contracts.active.target);
  const notes = contractsStep(s);
  assert.equal(notes.find((n) => n.type !== 'offer')?.type, 'lost');

  const f = base();
  f.techs.t_nuclear = true;
  f.owned.nuclear = 2;
  f.heat.nuclear = { h: 0.9, off: 0 };
  const j = offer(f, 'firm');
  assert.ok(j >= 0);
  accept(f, j);
  f.stats.shutdowns.nuclear++;
  assert.equal(contractsStep(f).find((n) => n.type !== 'offer')?.type, 'lost');
});

test('contratos: desistir, pausar no disfarce/offline e sobreviver ao save', () => {
  const s = base();
  const i = offer(s, 'sales');
  accept(s, i);
  const deadline = s.market.contracts.active.deadline;
  holdContracts(s, 50);
  assert.equal(s.market.contracts.active.deadline, deadline + 50);
  assert.ok(progress(s) >= 0);
  const back = fromSave(JSON.parse(JSON.stringify(s)));
  assert.ok(isValidState(back));
  assert.deepEqual(back.market.contracts.active, s.market.contracts.active);
  assert.ok(abandon(s));
  assert.equal(s.market.contracts.failed, 1);
  assert.equal(abandon(s), false);
});

test('aba Mercado: 1–3 aceitam, D desiste; tudo cabe em 80×24', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi, visibleLength } = await import('../src/ui/format.js');
  const s = base();
  s.market.battery = { kwh: 1e12, banks: 10, cheap: true, auto: true };
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.key('k');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  for (let k = 0; k < 4; k++) { s.market.contracts.next = 0; contractsStep(s); }
  assert.equal(s.market.contracts.offers.length, 3);
  const fits = () => { const ls = app.lines(80, 24); assert.equal(ls.length, 24); for (const l of ls) assert.ok(visibleLength(l) <= 80, stripAnsi(l)); };
  fits();
  app.key('2');
  assert.ok(s.market.contracts.active);
  assert.match(text(), /ATIVO/);
  assert.match(text(), /Contrato aceito/);
  fits();
  app.key('1');
  assert.match(text(), /Já há um contrato ativo/);
  app.key('d');
  assert.equal(s.market.contracts.active, null);
  assert.match(text(), /Contrato abandonado/);
});

test('reputação: sobe com contratos e usinas em dia, cai com perdas e quebras esquecidas', async () => {
  const { addRep, repTier, repName, contractBonus } = await import('../src/core/market.js');
  const { REPUTATION } = await import('../src/data/market.js');
  const { marketStep } = await import('../src/core/market.js');
  const { price } = await import('../src/core/engine.js');
  const s = base();
  assert.equal(repName(s), 'Desconhecida');
  const p0 = price(s);
  assert.equal(addRep(s, REPUTATION.tiers[2].at), 2, 'subiu duas faixas');
  assert.equal(repName(s), 'Regional');
  assert.ok(Math.abs(contractBonus(s) - (1 + 2 * REPUTATION.rewardPerTier)) < 1e-12);
  assert.ok(Math.abs(price(s) / p0 - (1 + 2 * REPUTATION.pricePerTier)) < 1e-9);
  // Cuidado: usinas novas a cada avaliação somam; uma quebra esquecida tira.
  const rep = s.market.rep;
  s.market.retarget = Infinity;
  marketStep(s, REPUTATION.careEvery);
  assert.equal(s.market.rep, rep + REPUTATION.care);
  s.wear.broken.push({ gen: 'wind', at: s.t - REPUTATION.neglectAfter - 1 });
  marketStep(s, REPUTATION.careEvery);
  // Com a unidade parada a eficiência média também cai: sem o ponto de cuidado.
  assert.equal(s.market.rep, rep + REPUTATION.care - REPUTATION.neglect);
  // Contrato cumprido dá reputação; abandonar tira.
  const i = offer(s, 'sales');
  accept(s, i);
  const before = s.market.rep;
  abandon(s);
  assert.equal(s.market.rep, before - REPUTATION.contractLost);
  addRep(s, -1e9);
  assert.equal(s.market.rep, 0, 'nunca negativa');
  assert.equal(repTier(s), 0);
});
