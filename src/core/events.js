// Só dados de evento e o estado em `s.events`: não importa o engine (o engine e o
// heat.js consultam os multiplicadores daqui, sem ciclo de imports).
import { EVENTS, REWARD } from '../data/events.js';

// mulberry32 com o estado guardado no save: a mesma partida sorteia os mesmos eventos,
// e os testes podem fixar o seed.
export function rand(s) {
  let t = (s.events.rng = (s.events.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const eventDef = (id) => (id === REWARD.id ? REWARD : EVENTS.find((e) => e.id === id));

// until === null: crise, ativa até ser resolvida.
export const isActive = (s, a) => a.until === null || a.until > s.t;
export const activeEffects = (s) => s.events.effects.filter((a) => isActive(s, a));

export function eventMult(s, type, gen) {
  let m = 1;
  for (const a of activeEffects(s)) {
    for (const e of eventDef(a.id)?.effects ?? []) {
      if (e.type === type && (!e.gen || e.gen === gen)) m *= e.mult;
    }
  }
  return m;
}
