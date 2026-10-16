// Só lê e escreve `s.legacy` e reinicia a partida: não importa o engine, que é quem
// consulta os efeitos daqui (engine -> prestige, sem ciclo de imports).
import { LEGACY, SHOP, MONUMENT } from '../data/legacy.js';
import { TECHS } from '../data/research.js';
import { newState } from './state.js';
import { peak } from './records.js';

export const pointsFor = (money) => Math.floor(Math.sqrt(Math.max(0, money) / LEGACY.divisor));
export const lifetimeEarned = (s) => s.legacy.lifetime + s.earned;
export const legacyGain = (s) => Math.max(0, pointsFor(lifetimeEarned(s)) - s.legacy.earned);
export const canAscend = (s) => s.earned >= LEGACY.minRunEarned && legacyGain(s) >= 1;

// Quanto falta ganhar nesta partida para a prévia subir mais 1 ponto.
export function nextPointIn(s) {
  const total = s.legacy.earned + legacyGain(s);
  return (total + 1) ** 2 * LEGACY.divisor - lifetimeEarned(s);
}

export const monumentMult = (s) => MONUMENT.mult ** s.legacy.monument;
export const monumentCost = (s) => Math.ceil(MONUMENT.baseCost * MONUMENT.growth ** s.legacy.monument);
// Tudo o que o Legado dá à produção: pontos guardados e Monumento.
export const legacyMult = (s) => (1 + LEGACY.bonusPerPoint * s.legacy.points) * monumentMult(s);

export function buyMonument(s) {
  const cost = monumentCost(s);
  if (s.legacy.points < cost) return false;
  s.legacy.points -= cost;
  s.legacy.monument++;
  return true;
}

export const shopLevel = (s, item) => s.legacy.shop[item.id] ?? 0;
// Valor do efeito comprado de um tipo, ou `fallback` se nada foi comprado.
export function shopValue(s, type, fallback = null) {
  const item = SHOP.find((x) => x.type === type);
  const lvl = item ? shopLevel(s, item) : 0;
  return lvl ? item.values[lvl - 1] : fallback;
}
export const nextShopCost = (s, item) => item.costs[shopLevel(s, item)] ?? null;
// Vantagem extra do nível comprado de um tipo (`perks` em data/legacy.js), ou {}.
export function shopPerk(s, type) {
  const item = SHOP.find((x) => x.type === type);
  const lvl = item ? shopLevel(s, item) : 0;
  return (lvl && item.perks?.[lvl - 1]) || {};
}

// Desconto dos Contratos de Obra para outras compras ('cooling', 'transformers'): só
// nos níveis cujo perk as inclui. Geradores e laboratórios usam shopValue direto.
export const contractDiscount = (s, what) =>
  (shopPerk(s, 'cost').discount?.includes(what) ? shopValue(s, 'cost', 1) : 1);

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
  const run = s.stats.playTime;
  if (s.career.fastestRun === null || run < s.career.fastestRun) s.career.fastestRun = run;
  peak(s, 'bestGain', gain);
  const { career, achievements } = s;
  const legacy = {
    ...s.legacy,
    lifetime: lifetimeEarned(s),
    earned: s.legacy.earned + gain,
    points: s.legacy.points + gain,
    ascensions: s.legacy.ascensions + 1,
    shop: { ...s.legacy.shop },
  };
  const rng = s.events.rng; // a sorte continua de onde parou, não repete a 1ª partida
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, newState(rng), { legacy, career, achievements });
  startRun(s);
  return gain;
}

// O que a loja entrega pronto no começo de cada partida. A pesquisa vem como se tivesse
// sido concluída (sem custo nem ficha); automação herdada ou pesquisada já liga.
function startRun(s) {
  s.owned.wind = shopValue(s, 'start', 0);
  s.labs = shopPerk(s, 'lab').labs ?? 0;
  for (const id of [...shopValue(s, 'techs', []), ...(shopPerk(s, 'start').techs ?? [])]) s.techs[id] = true;
  for (const id of Object.keys(s.cooling)) s.cooling[id] = shopValue(s, 'cooling', 0);
  s.transformers = shopValue(s, 'transformers', 0);
  const autoTech = TECHS.some((t) => t.type === 'auto' && s.techs[t.id]);
  if (autoTech || shopValue(s, 'auto') !== null) s.auto.buy = true;
}
