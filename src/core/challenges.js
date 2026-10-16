// Regras da partida especial (s.run): o engine e os eventos consultam `rules(s)` e
// recebem valores neutros numa partida normal. Só importa dados: engine e incidents
// importam daqui sem ciclo.
import { CHALLENGES, GOALS } from '../data/challenges.js';
import { GENERATORS } from '../data/generators.js';

export const NEUTRAL = Object.freeze({
  eventGap: 1, crisisWeight: 1, disabled: [], noCrank: false, start: {}, techs: [],
  capacityExp: 1, priceHalfLife: null, priceFloor: 0, upkeep: 1, noReward: false, cost: {}, output: {}, heat: 1,
});

export const challengeDef = (id) => CHALLENGES.find((c) => c.id === id) ?? null;

// ---- semente do dia ----
// A data (local, AAAA-MM-DD) vira a seed da partida e sorteia 1 ou 2 desafios no nível I:
// quem joga no mesmo dia recebe o mesmo começo, os mesmos eventos iniciais e a mesma regra.

// FNV-1a de 32 bits: estável entre máquinas e versões do Node.
export function hashString(str) {
  let h = 0x811c9dc5;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const pad2 = (n) => String(n).padStart(2, '0');
export const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
export const dailySeed = (date) => hashString(`elden-grid:${date}`);

export function dailyChallenges(date) {
  const h = dailySeed(date);
  const first = h % CHALLENGES.length;
  const ids = [CHALLENGES[first].id];
  if ((h >>> 8) % 2) ids.push(CHALLENGES[(first + 1 + ((h >>> 16) % (CHALLENGES.length - 1))) % CHALLENGES.length].id);
  return ids;
}

// Código para comparar com os amigos: data, tempo e 3 caracteres de conferência (pega erro
// de digitação, não fraude: o jogo é offline).
export function dailyCode(date, seconds) {
  const sec = Math.round(seconds);
  const time = sec >= 3600
    ? `${Math.floor(sec / 3600)}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`
    : `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;
  const check = (hashString(`${date}|${time}`) % 36 ** 3).toString(36).toUpperCase().padStart(3, '0');
  return `EG-${date.slice(5, 7)}${date.slice(8, 10)}-${time}-${check}`;
}

// Regras da partida especial (ou neutras). A semente do dia junta as dos desafios sorteados.
export function rules(s) {
  const r = s.run;
  if (!r) return NEUTRAL;
  if (r.challenge) return { ...NEUTRAL, ...challengeDef(r.challenge)?.rules[r.tier - 1] };
  if (r.daily) return Object.assign({ ...NEUTRAL }, ...dailyChallenges(r.daily).map((id) => challengeDef(id).rules[0]));
  return NEUTRAL;
}

export const isChallenge = (s) => !!s.run?.challenge;
export const isDaily = (s) => !!s.run?.daily;
export const runGoal = (s) => (isChallenge(s) ? GOALS[s.run.tier - 1] : isDaily(s) ? GOALS[0] : null);
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
export const goalReached = (s) => !!s.run && !s.run.done && s.earned >= runGoal(s);
