// Regras da partida especial (s.run): o engine e os eventos consultam `rules(s)` e
// recebem valores neutros numa partida normal. Só importa dados: engine e incidents
// importam daqui sem ciclo.
import { CHALLENGES, GOALS } from '../data/challenges.js';
import { GENERATORS } from '../data/generators.js';

export const NEUTRAL = Object.freeze({
  eventGap: 1, crisisWeight: 1, disabled: [], noCrank: false, start: {}, techs: [],
  capacityExp: 1, priceHalfLife: null, priceFloor: 0, upkeep: 1,
});

export const challengeDef = (id) => CHALLENGES.find((c) => c.id === id) ?? null;

// Regras do desafio em andamento (ou neutras). A semente do dia junta várias.
export function rules(s) {
  const r = s.run;
  if (!r) return NEUTRAL;
  if (r.challenge) return { ...NEUTRAL, ...challengeDef(r.challenge)?.rules[r.tier - 1] };
  return NEUTRAL;
}

export const isChallenge = (s) => !!s.run?.challenge;
export const runGoal = (s) => (isChallenge(s) ? GOALS[s.run.tier - 1] : null);
export const genDisabled = (s, g) => rules(s).disabled.includes(g.id);

// Preço com o mercado em queda: cai à metade a cada `priceHalfLife` s, até o piso.
export function priceDecay(s) {
  const { priceHalfLife, priceFloor } = rules(s);
  if (!priceHalfLife) return 1;
  return Math.max(priceFloor, 0.5 ** (s.stats.playTime / priceHalfLife));
}

// Começo da partida de desafio: unidades e pesquisas da regra. A partida em si é um
// newState() comum (sem legado), marcado com `run`.
export function applyRunStart(s) {
  const r = rules(s);
  for (const [id, n] of Object.entries(r.start)) if (GENERATORS.some((g) => g.id === id)) s.owned[id] = n;
  for (const id of r.techs) s.techs[id] = true;
}

// Meta cumprida? Só conta uma vez (run.done marca o fim do desafio).
export const goalReached = (s) => isChallenge(s) && !s.run.done && s.earned >= runGoal(s);
