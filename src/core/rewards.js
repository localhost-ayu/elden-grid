// Recompensas dos desafios: vêm do perfil compartilhado, que não mora no save. O app
// informa qual perfil está valendo (useProfile) e o engine consulta daqui, como faz com
// as regras do desafio. Sem chamada a useProfile, vale um perfil vazio (tudo neutro).
// Dentro de um desafio ou da semente do dia (s.run) nada daqui vale: partida justa.
import { CHALLENGES, TIER_MULT } from '../data/challenges.js';
import { newProfile, challengeTier } from './profile.js';

let active = newProfile();
export const useProfile = (p) => { active = p ?? newProfile(); };
export const activeProfile = () => active;

export const totalTiers = (p = active) => CHALLENGES.reduce((n, c) => n + challengeTier(p, c.id), 0);

// Multiplicador global de produção (x TIER_MULT por nível completo).
export const rewardMult = (s) => (s.run ? 1 : TIER_MULT ** totalTiers());

// Vantagem temática somada: `per` × níveis do desafio cuja recompensa é deste tipo.
export function reward(s, type) {
  if (s.run) return 0;
  const c = CHALLENGES.find((x) => x.reward.type === type);
  return c ? c.reward.per * challengeTier(active, c.id) : 0;
}

// Começo de partida (jogo novo ou ascensão): Brisa Solar já traz a pesquisa da solar.
export function rewardStart(s) {
  if (reward(s, 'solar') > 0) s.techs.t_solar = true;
}
