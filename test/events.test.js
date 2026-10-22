import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { EVENTS, SCHEDULE, DAMAGE, REWARD, CRISIS } from '../src/data/events.js';
import { rand, eventMult } from '../src/core/events.js';
import { MINIGAMES } from '../src/core/minigames.js';
import {
  eventsStep, eligibleEvents, beginCrisis, crisisInput, callCrew, damage, currentEvent, crisisLevel, damageTerms, rewardDuration,
} from '../src/core/incidents.js';
import { power, price, capacity, tick, applyOffline, income } from '../src/core/engine.js';
import { heatTarget } from '../src/core/heat.js';
import { GENERATORS } from '../src/data/generators.js';
import { ascend } from '../src/core/prestige.js';
import { LEGACY } from '../src/data/legacy.js';

const gen = (id) => GENERATORS.find((g) => g.id === id);

// Roda o jogo em passos de 0.1 s junto com os eventos, como o loop real.
function play(s, seconds) {
  const notes = [];
  for (let i = 0; i < seconds * 10; i++) {
    tick(s, 0.1);
    notes.push(...eventsStep(s, 0.1));
  }
  return notes;
}

function withCrisis(id) {
  const s = newState();
  s.owned.wind = 50;
  s.money = 1e6;
  s.events.effects.push({ id, until: null });
  s.events.crisis = { id, deadline: SCHEDULE.crisisDeadline, game: null };
  return s;
}

test('rng com seed: mesma partida, mesma sequência; seeds diferentes divergem', () => {
  const a = newState(42);
  const b = newState(42);
  const c = newState(43);
  const seqA = Array.from({ length: 5 }, () => rand(a));
  assert.deepEqual(seqA, Array.from({ length: 5 }, () => rand(b)));
  assert.notDeepEqual(seqA, Array.from({ length: 5 }, () => rand(c)));
  for (const x of seqA) assert.ok(x >= 0 && x < 1);
  assert.ok(Number.isInteger(a.events.rng)); // estado cabe em JSON
});

test('eventos sorteados são determinísticos dado o seed', () => {
  const run = (seed) => {
    const s = newState(seed);
    s.owned.wind = 30;
    s.labs = 1;
    return play(s, 900).filter((n) => n.type === 'start' || n.type === 'crisis').map((n) => n.id);
  };
  const first = run(7);
  assert.ok(first.length >= 3, `poucos eventos: ${first}`);
  assert.deepEqual(run(7), first);
});

test('primeiro evento só depois do aprendizado; um evento por vez', () => {
  const s = newState(3);
  s.owned.wind = 30;
  const notes = play(s, SCHEDULE.first - 1);
  assert.equal(notes.length, 0);
  play(s, 2);
  assert.ok(currentEvent(s));
  assert.equal(s.events.seen, 1);
  assert.equal(s.events.effects.filter((a) => a.id !== REWARD.id).length, 1);
});

test('requisitos: crise de calor só com reator, blecaute só com produção', () => {
  const s = newState();
  const ids = () => eligibleEvents(s).map((e) => e.id);
  assert.ok(!ids().includes('blackout'));
  assert.ok(ids().includes('heatwave') && !ids().includes('heatwave_crisis'));
  assert.ok(!ids().includes('discovery'));
  s.owned.nuclear = 1;
  s.labs = 1;
  assert.ok(ids().includes('blackout') && ids().includes('heatwave_crisis') && !ids().includes('heatwave'));
  assert.ok(ids().includes('discovery'));
});

test('efeitos de evento compõem produção, preço, capacidade e calor; acabam no prazo', () => {
  const s = newState();
  s.owned.wind = 10;
  const p0 = power(s);
  const price0 = price(s);
  const cap0 = capacity(s);
  s.events.effects.push({ id: 'storm', until: 30 }, { id: 'demand', until: 30 });
  assert.equal(eventMult(s, 'output', 'wind'), 2);
  assert.equal(eventMult(s, 'output', 'solar'), 0.5);
  assert.ok(Math.abs(power(s) - p0 * 2) < 1e-9);
  assert.ok(Math.abs(price(s) - price0 * 2) < 1e-12);
  s.events.effects.push({ id: 'overload', until: null }, { id: 'heatwave_crisis', until: null });
  assert.equal(capacity(s), cap0 / 2);
  s.owned.nuclear = 1;
  const h = heatTarget(s, gen('nuclear'), 1);
  s.events.effects = s.events.effects.filter((a) => a.id !== 'heatwave_crisis');
  assert.ok(Math.abs(h - heatTarget(s, gen('nuclear'), 1) * 1.4) < 1e-12);
  s.t = 31;
  assert.equal(eventMult(s, 'output', 'wind'), 1); // tempestade acabou
  assert.equal(capacity(s), cap0 / 2);             // crise continua até resolver
});

test('offline não sofre o blecaute que estava ativo no save', () => {
  const a = withCrisis('blackout');
  const b = newState();
  b.owned.wind = 50;
  assert.equal(applyOffline(a, 600).energy, applyOffline(b, 600).energy);
});

test('descoberta dá PP proporcional ao laboratório', () => {
  const s = newState(11);
  s.labs = 4;
  s.events.next = 0;
  // força o sorteio até sair uma descoberta
  let note;
  for (let i = 0; i < 200 && note?.id !== 'discovery'; i++) {
    s.events.effects = [];
    s.events.crisis = null;
    s.events.next = s.t;
    [note] = eventsStep(s, 0);
  }
  assert.equal(note.id, 'discovery');
  assert.ok(note.rp > 0);
});

test('danos: o menor entre uma fração do caixa e alguns segundos de renda, maiores no nível alto', () => {
  const s = newState();
  s.owned.wind = 10;
  s.money = 1e9;
  assert.equal(damage(s), income(s) * DAMAGE.incomeSeconds[0]);
  s.money = 100;
  assert.equal(damage(s), 100 * DAMAGE.moneyShare[0]);
  s.legacy.ascensions = CRISIS.maxLevel;
  assert.equal(damage(s), 100 * DAMAGE.moneyShare[1]);
  s.money = 1e9;
  assert.equal(damage(s), income(s) * DAMAGE.incomeSeconds[1]);
  assert.deepEqual(damageTerms(s), { moneyShare: DAMAGE.moneyShare[1], incomeSeconds: DAMAGE.incomeSeconds[1] });
  assert.equal(rewardDuration(s), REWARD.duration[1]);
  s.legacy.ascensions = 0;
  assert.equal(rewardDuration(s), REWARD.duration[0]);
  s.money = 0;
  assert.equal(damage(s), 0);
});

test('crise vencida: sem custo, efeito some e vem o bônus', () => {
  const s = withCrisis('overload');
  assert.equal(crisisInput(s, 'up'), null); // antes de começar, nada acontece
  assert.equal(beginCrisis(s), true);
  assert.equal(beginCrisis(s), false);
  const money = s.money;
  let done = null;
  for (const k of s.events.crisis.game.seq) done = crisisInput(s, k) ?? done;
  assert.deepEqual(done, { type: 'resolved', id: 'overload', outcome: 'won', cost: 0 });
  assert.equal(s.money, money);
  assert.equal(s.events.crisis, null);
  assert.equal(eventMult(s, 'capacity'), 1);
  assert.equal(eventMult(s, 'output', 'wind'), REWARD.effects[0].mult);
  assert.ok(s.events.next > s.t); // próximo evento agendado
});

test('crise perdida, equipe chamada ou ignorada: cobra os danos', () => {
  const lost = withCrisis('overload');
  beginCrisis(lost);
  const g = lost.events.crisis.game;
  const wrong = (k) => ['up', 'right', 'down', 'left'].find((x) => x !== k);
  const cost = damage(lost);
  let done = null;
  for (let i = 0; i < 3; i++) done = crisisInput(lost, wrong(g.seq[g.idx])) ?? done;
  assert.equal(done.outcome, 'lost');
  assert.ok(Math.abs(done.cost - cost) < 1e-6);

  const crew = withCrisis('blackout');
  const c2 = damage(crew);
  const r = callCrew(crew);
  assert.equal(r.outcome, 'crew');
  assert.equal(crew.money, 1e6 - c2);
  assert.equal(eventMult(crew, 'output', 'wind'), 1); // sem bônus

  const idle = withCrisis('blackout');
  const notes = play(idle, SCHEDULE.crisisDeadline + 1);
  assert.equal(notes.find((n) => n.type === 'resolved').outcome, 'timeout');
  assert.equal(idle.events.crisis, null);
});

test('minijogo de timing: acerto na faixa, erro fora, faixa estreita e acelera', () => {
  const r = () => 0.5;
  const g = MINIGAMES.timing.create(r);
  const w = g.width;
  const v = g.speed;
  g.pos = g.zone + g.width / 2;
  MINIGAMES.timing.input(g, 'space', r);
  assert.equal(g.hits, 1);
  assert.ok(g.width < w && g.speed > v);
  assert.equal(g.last.ok, true);
  g.pos = (g.zone + g.width + 0.05) % 1;
  MINIGAMES.timing.input(g, 'space', r);
  assert.equal(g.misses, 1);
  assert.equal(MINIGAMES.timing.input(g, 'x', r), false); // tecla que não é do jogo
  MINIGAMES.timing.step(g, 0.5);
  assert.ok(g.pos >= 0 && g.pos < 1);
  MINIGAMES.timing.step(g, 30);
  assert.equal(g.status, 'lost'); // tempo esgotado
});

test('minijogo de pressão: alternar no ritmo segura a faixa; martelar estoura', () => {
  const M = MINIGAMES.mash;
  const g = M.create(() => 0.5);
  M.input(g, 'left');
  M.input(g, 'left'); // segurar a mesma tecla não sobe
  assert.equal(g.fill, g.gain);
  M.step(g, 0.1);
  assert.ok(g.fill < g.gain, 'a pressão vaza');
  // No ritmo: sobe até a faixa e aperta só quando cai abaixo do centro.
  const calm = M.create(() => 0.5);
  let dir = 'left';
  for (let i = 0; i < 400 && calm.status === 'playing'; i++) {
    if (calm.fill < calm.center) { M.input(calm, dir); dir = dir === 'left' ? 'right' : 'left'; }
    M.step(calm, 0.05);
  }
  assert.equal(calm.status, 'won');
  assert.equal(calm.bursts, 0);
  // Martelando: passa da faixa, chega a 100% e estoura até perder.
  const spam = M.create(() => 0.5);
  for (let i = 0; i < 200 && spam.status === 'playing'; i++) {
    M.input(spam, i % 2 ? 'left' : 'right');
    M.step(spam, 0.02);
  }
  assert.equal(spam.status, 'lost');
  assert.equal(spam.bursts, spam.maxBursts);
  const slow = M.create(() => 0.5);
  M.step(slow, slow.timeLeft + 1);
  assert.equal(slow.status, 'lost');
});

test('nível da crise: parâmetros vão do fácil (0) ao difícil (máximo)', () => {
  const r = () => 0.5;
  const easy = { t: MINIGAMES.timing.create(r, 0), m: MINIGAMES.mash.create(r, 0), q: MINIGAMES.sequence.create(r, 0) };
  const hard = { t: MINIGAMES.timing.create(r, CRISIS.maxLevel), m: MINIGAMES.mash.create(r, CRISIS.maxLevel), q: MINIGAMES.sequence.create(r, CRISIS.maxLevel) };
  assert.ok(hard.t.width < easy.t.width && hard.t.speed > easy.t.speed && hard.t.need > easy.t.need);
  assert.ok(hard.m.band < easy.m.band && hard.m.hold > easy.m.hold && hard.m.leak > easy.m.leak);
  assert.equal(easy.m.drift, 0);
  assert.ok(hard.m.drift > 0, 'a faixa oscila no nível alto');
  assert.ok(hard.q.seq.length > easy.q.seq.length);
  assert.equal(easy.q.hideAt, null);
  assert.ok(hard.q.hideAt > 0, 'a sequência some no nível alto');
  // Nível vem das ascensões, com teto; desafios usam o nível fixo.
  const s = newState();
  assert.equal(crisisLevel(s), 0);
  s.legacy.ascensions = 3;
  assert.equal(crisisLevel(s), 3);
  s.legacy.ascensions = 99;
  assert.equal(crisisLevel(s), CRISIS.maxLevel);
  s.run = { daily: '2026-10-16' };
  assert.equal(crisisLevel(s), CRISIS.runLevel);
  s.run = { challenge: 'calm', tier: 5 };
  assert.equal(crisisLevel(s), CRISIS.runLevel);
  s.run = { challenge: 'blackout', tier: 1 };
  assert.equal(crisisLevel(s), 3);
  s.run = { challenge: 'blackout', tier: 5 };
  assert.equal(crisisLevel(s), CRISIS.maxLevel, 'Apagão Eterno V: crises no nível máximo');
});

test('save v6 migra para v7; minijogo pela metade volta ao alerta ao carregar', () => {
  const v6 = { saveVersion: 6, savedAt: 1234, state: { ...newState() } };
  delete v6.state.events;
  const env = migrate(v6);
  assert.equal(env.saveVersion, SAVE_VERSION);
  const s = fromSave(env.state);
  assert.equal(s.events.rng, 1234);
  assert.ok(isValidState(s));
  const mid = withCrisis('blackout');
  beginCrisis(mid);
  const back = fromSave(JSON.parse(JSON.stringify(mid)));
  assert.equal(back.events.crisis.game, null);
  assert.ok(isValidState(back));
  assert.equal(isValidState({ ...s, events: { ...s.events, rng: -1 } }), false);
  assert.equal(isValidState({ ...s, events: { ...s.events, effects: [{ id: 'x', until: NaN }] } }), false);
});

test('ascender mantém a sorte correndo (não repete os eventos da 1ª partida)', () => {
  const s = newState(5);
  rand(s);
  const rng = s.events.rng;
  s.earned = LEGACY.minRunEarned;
  s.owned.antimatter = 1;
  assert.ok(ascend(s) > 0);
  assert.equal(s.events.rng, rng);
  assert.equal(s.events.crisis, null);
});

test('todo evento tem dados válidos', () => {
  for (const e of EVENTS) {
    assert.ok(e.id && e.name && e.desc && e.weight > 0, e.id);
    assert.ok(e.crisis || e.duration > 0, e.id);
    if (e.crisis) assert.ok(['o', 'a'].includes(e.article), `${e.id} sem artigo`);
  }
});

test('minijogo de contenção: corrigir a deriva segura a faixa; largar rompe ou estoura o tempo', () => {
  const M = MINIGAMES.balance;
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const level of [0, CRISIS.maxLevel]) {
    const g = M.create(r, level);
    for (let i = 0; i < 2000 && g.status === 'playing'; i++) {
      // Jogador atento: freia quando o ponteiro anda para fora.
      if (g.pos + g.vel * 0.3 > g.zone / 2) M.input(g, 'left');
      else if (g.pos + g.vel * 0.3 < -g.zone / 2) M.input(g, 'right');
      M.step(g, 0.05);
    }
    assert.equal(g.status, 'won', `nível ${level}`);
  }
  const idle = M.create(r, CRISIS.maxLevel);
  for (let i = 0; i < 2000 && idle.status === 'playing'; i++) M.step(idle, 0.05);
  assert.equal(idle.status, 'lost');
  assert.equal(M.input(idle, 'up'), false);
});

test('minijogo da tempestade: bloquear cada erupção a tempo vence; deixar passar perde', () => {
  const M = MINIGAMES.shield;
  const r = () => 0.42;
  const g = M.create(r, 0);
  for (let i = 0; i < 2000 && g.status === 'playing'; i++) {
    M.step(g, 0.05);
    for (const f of [...g.flares]) if (f.left < g.warn / 2) M.input(g, f.dir);
  }
  assert.equal(g.status, 'won');
  assert.equal(g.hits, 0);
  const idle = M.create(r, CRISIS.maxLevel);
  for (let i = 0; i < 2000 && idle.status === 'playing'; i++) M.step(idle, 0.05);
  assert.equal(idle.status, 'lost');
  assert.equal(idle.hits, idle.maxHits);
  const wrong = M.create(r, 0);
  M.input(wrong, 'up');
  assert.equal(wrong.last.ok, false, 'seta sem erupção é erro');
});
