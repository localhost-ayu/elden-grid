// Sorteio de eventos e ciclo de vida das crises: alerta -> minijogo -> resolução.
// Um evento por vez, para o jogador sempre saber o que está acontecendo.
// Não roda offline (quem chama é o loop do jogo, nunca applyOffline).
import { EVENTS, CRISES, SCHEDULE, DAMAGE, REWARD } from '../data/events.js';
import { rand, eventDef, isActive } from './events.js';
import { MINIGAMES } from './minigames.js';
import { power, income, rpRate, gridLoad } from './engine.js';
import { HOT_GENERATORS } from './heat.js';

const hasReactor = (s) => HOT_GENERATORS.some((g) => s.owned[g.id] > 0);
const REQUIRES = {
  lab: (s) => rpRate(s) > 0,
  reactor: hasReactor,
  noReactor: (s) => !hasReactor(s),
  power: (s) => power(s) > 0,
  loaded: (s) => gridLoad(s) > 0.5,
};

export const eligibleEvents = (s) => EVENTS.filter((e) => !e.requires || REQUIRES[e.requires](s));

function pick(s) {
  const list = eligibleEvents(s);
  let r = rand(s) * list.reduce((sum, e) => sum + e.weight, 0);
  for (const e of list) if ((r -= e.weight) < 0) return e;
  return list.at(-1);
}

const scheduleNext = (s) => {
  s.events.next = s.t + SCHEDULE.gapMin + rand(s) * (SCHEDULE.gapMax - SCHEDULE.gapMin);
};

export const crisisDef = (s) => s.events.crisis && CRISES[eventDef(s.events.crisis.id).crisis];
export const damage = (s) => Math.max(0, Math.min(s.money * DAMAGE.moneyShare, income(s) * DAMAGE.incomeSeconds));
// Evento em andamento (não conta o bônus de recompensa), ou null.
export const currentEvent = (s) => s.events.effects.find((a) => a.id !== REWARD.id && isActive(s, a)) ?? null;

function start(s, e) {
  s.events.seen++;
  if (e.crisis) {
    s.events.effects.push({ id: e.id, until: null });
    s.events.crisis = { id: e.id, deadline: s.t + SCHEDULE.crisisDeadline, game: null };
    return { type: 'crisis', id: e.id };
  }
  s.events.effects.push({ id: e.id, until: s.t + e.duration });
  const rp = e.rpSeconds ? rpRate(s) * e.rpSeconds : 0;
  s.rp += rp;
  return { type: 'start', id: e.id, rp };
}

// outcome: 'won' | 'lost' | 'crew' (jogador chamou) | 'timeout' (ninguém atendeu)
function resolve(s, outcome) {
  const c = s.events.crisis;
  const cost = outcome === 'won' ? 0 : damage(s);
  s.money -= cost;
  s.events.effects = s.events.effects.filter((a) => a.id !== c.id);
  if (outcome === 'won') s.events.effects.push({ id: REWARD.id, until: s.t + REWARD.duration });
  s.events.crisis = null;
  scheduleNext(s);
  return { type: 'resolved', id: c.id, outcome, cost };
}

const playing = (s) => s.events.crisis?.game?.status === 'playing';
const settle = (s) => {
  const g = s.events.crisis?.game;
  return g && g.status !== 'playing' ? resolve(s, g.status) : null;
};

// Avança eventos e crise. Retorna notas para a UI avisar: start, end, crisis, resolved.
export function eventsStep(s, dt) {
  const ev = s.events;
  const notes = [];
  for (const a of ev.effects.filter((x) => !isActive(s, x))) {
    notes.push({ type: 'end', id: a.id });
    if (a.id !== REWARD.id) scheduleNext(s);
  }
  ev.effects = ev.effects.filter((a) => isActive(s, a));
  if (ev.crisis) {
    if (playing(s)) MINIGAMES[ev.crisis.game.kind].step(ev.crisis.game, dt);
    const done = settle(s) ?? (s.t >= ev.crisis.deadline && !playing(s) ? resolve(s, 'timeout') : null);
    if (done) notes.push(done);
  } else if (!currentEvent(s) && s.t >= ev.next) {
    notes.push(start(s, pick(s)));
  }
  return notes;
}

// O minijogo só começa quando o jogador pede (lê o manual antes, sem pressa).
export function beginCrisis(s) {
  const c = s.events.crisis;
  if (!c || c.game) return false;
  c.game = MINIGAMES[crisisDef(s).game].create(() => rand(s));
  return true;
}

// Retorna a nota de resolução se a tecla terminou o minijogo; null caso contrário.
export function crisisInput(s, key) {
  if (!playing(s)) return null;
  const g = s.events.crisis.game;
  MINIGAMES[g.kind].input(g, key, () => rand(s));
  return settle(s);
}

export const callCrew = (s) => (s.events.crisis ? resolve(s, 'crew') : null);
