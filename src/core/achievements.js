// Interpreta as condições de src/data/achievements.js. `s.achievements` = { id: t }, com
// t = tempo de jogo da carreira quando a conquista saiu (para a tela mostrar quando).
// O bônus de produção fica no engine (achievementMult), que não importa este módulo.
import { ACHIEVEMENTS } from '../data/achievements.js';
import { GENERATORS } from '../data/generators.js';
import { TECHS } from '../data/research.js';
import { SHOP } from '../data/legacy.js';
import { COOLING } from '../data/heat.js';
import { bought, power, income, gridLoad, upgradeLevel, upgradeTrack } from './engine.js';
import { HOT_GENERATORS, coolingLevel, heatLevel, isShutdown } from './heat.js';
import { shopLevel } from './prestige.js';
import { activeProfile, totalTiers } from './rewards.js';
import { challengeTier } from './profile.js';
import { CHALLENGES } from '../data/challenges.js';

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj) ?? 0;
const ratio = (v, at) => (at > 0 ? v / at : 0);
// Menor é melhor (tempos): null = nunca aconteceu.
const under = (v, at) => (v === null || v === undefined ? 0 : v <= 0 ? 1 : at / v);

// Progresso de cada tipo de condição: >= 1 = conquistada.
const PROGRESS = {
  career: (s, a) => ratio(get(s.career, a.key), a.at),
  run: (s, a) => ratio(get(s.stats, a.key), a.at),
  sum: (s, a) => ratio(Object.values(s.career[a.key]).reduce((x, y) => x + y, 0), a.at),
  owned: (s, a) => ratio(a.gen === 'any' ? Math.max(...Object.values(s.owned)) : s.owned[a.gen], a.at),
  ownedAll: (s, a) => Math.min(...GENERATORS.map((g) => ratio(s.owned[g.id], a.at))),
  tech: (s, a) => (bought(s, a.tech) ? 1 : 0),
  techs: (s, a) => ratio(TECHS.filter((t) => bought(s, t.id)).length, a.at),
  upgradesMax: (s, a) => ratio(GENERATORS.filter((g) => upgradeLevel(s, g) >= upgradeTrack(g).length).length, a.at),
  transformers: (s, a) => ratio(s.transformers, a.at),
  coolingMax: (s) => (HOT_GENERATORS.some((g) => coolingLevel(s, g) >= COOLING.levels.length) ? 1 : 0),
  heat: (s, a) => Math.max(0, ...HOT_GENERATORS.filter((g) => s.owned[g.id] && !isShutdown(s, g)).map((g) => ratio(heatLevel(s, g), a.at))),
  power: (s, a) => ratio(power(s), a.at),
  income: (s, a) => ratio(income(s), a.at),
  gridLoad: (s, a) => ratio(gridLoad(s), a.at),
  money: (s, a) => ratio(s.money, a.at),
  legacy: (s, a) => ratio(s.legacy[a.key], a.at),
  shopMax: (s, a) => ratio(SHOP.filter((it) => shopLevel(s, it) >= it.costs.length).length, a.at),
  fastest: (s, a) => under(s.career.fastestRun, a.at),
  fastWin: (s, a) => under(s.career.bestWin[a.game], a.at),
  without: (s, a) => (get(s.stats, a.key) === 0 ? ratio(s.stats.moneyEarned, a.at) : 0),
  count: (s, a) => ratio(Object.keys(s.achievements).length, a.at),
  // As de desafio olham o perfil compartilhado (não o save): saem no save que estiver aberto.
  challenge: (s, a) => ratio(challengeTier(activeProfile(), a.challenge), a.at),
  tiers: (s, a) => ratio(totalTiers(), a.at),
  allTiers: (s, a) => Math.min(...CHALLENGES.map((c) => ratio(challengeTier(activeProfile(), c.id), a.at))),
  dailies: (s, a) => ratio(Object.keys(activeProfile().daily).length, a.at),
  dailyFast: (s, a) => under(Math.min(Infinity, ...Object.values(activeProfile().daily)), a.at),
};

export const hasAchievement = (s, id) => id in s.achievements;
export const achievementCount = (s) => ACHIEVEMENTS.filter((a) => hasAchievement(s, a.id)).length;
// 0..1 (conquistada = 1). Condições do tipo sim/não só valem 0 ou 1.
export const achievementProgress = (s, a) => (hasAchievement(s, a.id) ? 1 : Math.min(1, PROGRESS[a.type](s, a)));

// Desbloqueia o que estiver cumprido; retorna as conquistas novas, para a UI anunciar.
// Barato o bastante para rodar a cada quadro: só olha as que ainda faltam.
export function checkAchievements(s) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (hasAchievement(s, a.id) || PROGRESS[a.type](s, a) < 1) continue;
    s.achievements[a.id] = s.career.playTime;
    fresh.push(a);
  }
  // "Colecionador" depende das outras: uma segunda passada pega a que acabou de virar.
  if (fresh.length) fresh.push(...checkAchievements(s));
  return fresh;
}
