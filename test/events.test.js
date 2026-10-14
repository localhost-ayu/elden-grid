import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate, fromSave, isValidState, SAVE_VERSION } from '../src/core/state.js';
import { EVENTS, SCHEDULE, DAMAGE, REWARD } from '../src/data/events.js';
import { rand, eventMult } from '../src/core/events.js';
import { MINIGAMES } from '../src/core/minigames.js';
import {
  eventsStep, eligibleEvents, beginCrisis, crisisInput, callCrew, damage, currentEvent,
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

test('danos: o menor entre 10% do caixa e 1 min de renda', () => {
  const s = newState();
  s.owned.wind = 10;
  s.money = 1e9;
  assert.equal(damage(s), income(s) * DAMAGE.incomeSeconds);
  s.money = 100;
  assert.equal(damage(s), 100 * DAMAGE.moneyShare);
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

test('minijogo de pressão: só alternar conta e a pressão vaza', () => {
  const g = MINIGAMES.mash.create();
  MINIGAMES.mash.input(g, 'left');
  MINIGAMES.mash.input(g, 'left'); // segurar a mesma tecla não enche
  assert.equal(g.fill, g.gain);
  MINIGAMES.mash.step(g, 0.1);
  assert.ok(g.fill < g.gain);
  for (let i = 0; i < 20; i++) MINIGAMES.mash.input(g, i % 2 ? 'left' : 'right');
  assert.equal(g.status, 'won');
  const slow = MINIGAMES.mash.create();
  MINIGAMES.mash.step(slow, 11);
  assert.equal(slow.status, 'lost');
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
  ascend(s);
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
