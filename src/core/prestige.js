// Só lê e escreve `s.legacy` e reinicia a partida: não importa o engine, que é quem
// consulta os efeitos daqui (engine -> prestige, sem ciclo de imports).
import { LEGACY, SHOP } from '../data/legacy.js';
import { newState } from './state.js';

export const pointsFor = (money) => Math.floor(Math.sqrt(Math.max(0, money) / LEGACY.divisor));
export const lifetimeEarned = (s) => s.legacy.lifetime + s.earned;
export const legacyGain = (s) => Math.max(0, pointsFor(lifetimeEarned(s)) - s.legacy.earned);
export const canAscend = (s) => s.earned >= LEGACY.minRunEarned && legacyGain(s) >= 1;

// Quanto falta ganhar nesta partida para a prévia subir mais 1 ponto.
export function nextPointIn(s) {
  const total = s.legacy.earned + legacyGain(s);
  return (total + 1) ** 2 * LEGACY.divisor - lifetimeEarned(s);
}

export const legacyMult = (s) => 1 + LEGACY.bonusPerPoint * s.legacy.points;

export const shopLevel = (s, item) => s.legacy.shop[item.id] ?? 0;
// Valor do efeito comprado de um tipo, ou `fallback` se nada foi comprado.
export function shopValue(s, type, fallback = null) {
  const item = SHOP.find((x) => x.type === type);
  const lvl = item ? shopLevel(s, item) : 0;
  return lvl ? item.values[lvl - 1] : fallback;
}
export const nextShopCost = (s, item) => item.costs[shopLevel(s, item)] ?? null;

export function buyShop(s, id) {
  const item = SHOP.find((x) => x.id === id);
  const cost = item && nextShopCost(s, item);
  if (cost == null || s.legacy.points < cost) return false;
  s.legacy.points -= cost;
  s.legacy.shop[id] = shopLevel(s, item) + 1;
  return true;
}

// Reinicia a partida mantendo só o legado. Muta `s` no lugar porque a UI e o storage
// seguram a mesma referência. Retorna os pontos ganhos (0 = não podia ascender).
export function ascend(s) {
  if (!canAscend(s)) return 0;
  const gain = legacyGain(s);
  const legacy = {
    ...s.legacy,
    lifetime: lifetimeEarned(s),
    earned: s.legacy.earned + gain,
    points: s.legacy.points + gain,
    ascensions: s.legacy.ascensions + 1,
    shop: { ...s.legacy.shop },
  };
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, newState(), { legacy });
  s.owned.wind = shopValue(s, 'start', 0);
  if (shopValue(s, 'auto') !== null) s.auto.buy = true;
  return gain;
}
