import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, fromSave, isValidState } from '../src/core/state.js';
import { GENERATORS } from '../src/data/generators.js';
import { WEAR, WEAR_BY_GEN } from '../src/data/wear.js';
import { wearLevel, wearFactor, breakdownStep, brokenCount } from '../src/core/wear.js';
import { tick, power, income } from '../src/core/engine.js';
import { payClean, cleanCost, payFix, toggleCrew } from '../src/core/actions.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);

test('desgaste: cresce com o tempo de jogo até o piso de eficiência; offline não desgasta', () => {
  const s = newState();
  s.owned.solar = 10;
  s.techs.t_solar = true;
  tick(s, 3600, true);
  assert.equal(wearLevel(s, gen('solar')), 0, 'offline não desgasta');
  s.t = 0;
  const fresh = power(s);
  for (let i = 0; i < WEAR_BY_GEN.solar.time; i++) tick(s, 1);
  assert.equal(wearLevel(s, gen('solar')), 1);
  assert.ok(Math.abs(wearFactor(s, gen('solar')) - WEAR.floor) < 1e-12, 'nunca abaixo do piso');
  assert.equal(wearLevel(s, gen('wind')), 0, 'fonte que não se tem não desgasta');
  s.t = 0;
  assert.ok(power(s) < fresh);
});

test('manutenção paga zera o desgaste pelo preço proporcional; equipe segura o teto e cobra da renda', () => {
  const s = newState();
  s.owned.wind = 30;
  s.money = 1e9;
  for (let i = 0; i < 450; i++) tick(s, 1); // metade do tempo da eólica
  const w = wearLevel(s, gen('wind'));
  assert.ok(w > 0.45 && w < 0.55, `${w}`);
  const c = cleanCost(s, gen('wind'));
  assert.ok(c > 0);
  const money = s.money;
  assert.ok(payClean(s, 'wind'));
  assert.equal(wearLevel(s, gen('wind')), 0);
  assert.ok(Math.abs(money - s.money - c) < 1e-6);
  assert.equal(payClean(s, 'wind'), false, 'nada a limpar');
  const before = income(s);
  assert.ok(toggleCrew(s));
  assert.ok(Math.abs(income(s) - before * (1 - WEAR.crewShare)) < 1e-9);
  for (let i = 0; i < 2000; i++) tick(s, 1);
  assert.ok(wearLevel(s, gen('wind')) <= WEAR.crewCap + 1e-12, 'a equipe segura o desgaste');
  assert.ok(s.stats.crewWages > 0);
});

test('quebras: no máximo duas, param uma unidade, o conserto pago ou a equipe resolvem', () => {
  const s = newState();
  s.owned.wind = 10;
  s.money = 1e12;
  const always = () => 0;
  const notes = [];
  for (let i = 0; i < 5; i++) notes.push(...breakdownStep(s, 1e6, always));
  assert.equal(notes.filter((n) => n.type === 'broke').length, WEAR.maxBroken);
  assert.equal(brokenCount(s, gen('wind')), WEAR.maxBroken);
  assert.ok(Math.abs(wearFactor(s, gen('wind')) - 8 / 10) < 1e-12);
  assert.ok(payFix(s, 'wind'));
  assert.equal(brokenCount(s, gen('wind')), 1);
  toggleCrew(s);
  s.t += WEAR.crewFixSeconds;
  const fixed = breakdownStep(s, 0, () => 0.99);
  assert.equal(fixed[0].type, 'fixed');
  assert.equal(s.wear.broken.length, 0);
  const one = newState();
  one.owned.wind = 1;
  assert.deepEqual(breakdownStep(one, 1e6, always), [], 'com uma unidade só, nada quebra');
  const back = fromSave(JSON.parse(JSON.stringify(s)));
  assert.ok(isValidState(back));
  assert.equal(isValidState({ ...back, wear: { ...back.wear, level: { wind: 2 } } }), false);
});

test('aba Rede, Manutenção: ↑↓ escolhe, F paga, J conserta à mão com as setas, A contrata a equipe', async () => {
  const { createApp } = await import('../src/ui/app.js');
  const { stripAnsi, visibleLength } = await import('../src/ui/format.js');
  const s = newState();
  s.owned.wind = 30;
  s.owned.solar = 10;
  s.techs.t_solar = true;
  s.money = 1e9;
  s.events.next = 1e9;
  s.wear.level.wind = 0.8;
  s.wear.level.solar = 0.5;
  s.wear.broken.push({ gen: 'solar', at: 0 });
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  app.key('r');
  for (let i = 0; i < 5; i++) app.key('v');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  assert.match(text(), /sem equipe/);
  assert.match(text(), /1 parada/);
  assert.match(text(), /Usinas \d+%/, 'aviso no cabeçalho');
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  app.key('f'); // eólica selecionada
  assert.equal(s.wear.level.wind, 0);
  assert.match(text(), /Manutenção de Turbina Eólica feita/);
  app.key('down');
  app.key('j');
  assert.match(text(), /Consertando Painel Solar à mão/);
  // As setas aparecem destacadas na ordem: lê a sequência da tela.
  const arrows = { '↑': 'up', '→': 'right', '↓': 'down', '←': 'left' };
  const seqLine = text().split('\n').find((l) => l.includes('Consertando'));
  const seq = [...seqLine.split(':')[1]].filter((ch) => ch in arrows).map((ch) => arrows[ch]);
  assert.equal(seq.length, WEAR.handArrows);
  for (const d of seq) app.key(d);
  assert.equal(s.wear.level.solar, 0);
  assert.equal(s.wear.broken.length, 0, 'à mão também conserta a quebrada');
  app.key('a');
  assert.equal(s.wear.crew, true);
  assert.match(text(), /equipe contratada/);
});

test('legado: Equipe Herdada começa contratada e cobra menos; Baterias Herdadas trazem bancos', async () => {
  const { ascend } = await import('../src/core/prestige.js');
  const { crewCut } = await import('../src/core/engine.js');
  const { LEGACY } = await import('../src/data/legacy.js');
  const s = newState();
  s.earned = LEGACY.minRunEarned;
  s.owned.antimatter = 1;
  s.legacy.shop.heircrew = 2;
  s.legacy.shop.heirbanks = 3;
  assert.ok(ascend(s) > 0);
  assert.equal(s.wear.crew, true);
  assert.equal(crewCut(s), 0.03);
  assert.equal(s.market.battery.banks, 5);
});

test('conquistas de mercado: contratos, reputação e manutenção à mão', async () => {
  const { checkAchievements } = await import('../src/core/achievements.js');
  const { addRep } = await import('../src/core/market.js');
  const s = newState();
  s.career.contractsDone = 1;
  s.career.cleanedByHand = 25;
  addRep(s, 30);
  const got = checkAchievements(s).map((a) => a.id);
  for (const id of ['m_contract1', 'm_hand25', 'm_rep2']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('m_rep4'));
});
