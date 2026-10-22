// Só lê e escreve `s.legacy` e reinicia a partida: não importa o engine, que é quem
// consulta os efeitos daqui (engine -> prestige, sem ciclo de imports).
import { LEGACY, SHOP, MONUMENT } from '../data/legacy.js';
import { TECHS } from '../data/research.js';
import { GENERATORS } from '../data/generators.js';
import { rewardStart } from './rewards.js';
import { newState } from './state.js';
import { peak } from './records.js';
import { chapterScale } from '../data/chapters.js';
import { patentValue } from './patents.js';

// Pontos = (dinheiro / divisor)^exponent, arredondado para baixo. A conta em ponto
// flutuante erra perto dos limites (8^(1/3) = 1.999…), então o resultado é conferido pela
// conta inversa, que é exata para os inteiros. `scale` (2.0) é a escala de dinheiro do
// capítulo: o Sistema Solar ganha 10^13 vezes mais que a Terra, e os pontos acompanham.
const threshold = (points, scale = 1) => points ** (1 / LEGACY.exponent) * LEGACY.divisor * scale;
export function pointsFor(money, scale = 1) {
  let p = Math.floor((Math.max(0, money) / (LEGACY.divisor * scale)) ** LEGACY.exponent);
  if (threshold(p + 1, scale) <= money) p++;
  else if (p > 0 && threshold(p, scale) > money) p--;
  return p;
}
export const pointsThreshold = threshold;
export const lifetimeEarned = (s) => s.legacy.lifetime + s.earned;
export const legacyGain = (s) => Math.max(0, pointsFor(lifetimeEarned(s), chapterScale(s)) - s.legacy.earned);
export const minRunEarned = (s) => LEGACY.minRunEarned * chapterScale(s);

// Condições de fim de partida (fase atual de LEGACY.gate): basta uma. Cada uma com o
// texto e se já foi cumprida, para a aba Legado mostrar o checklist.
const GATE = {
  region: (s, c) => s.region >= c.at,
  owned: (s, c) => (s.owned[c.gen] ?? 0) > 0,
  techs: (s) => TECHS.every((t) => (t.chapter && t.chapter !== s.chapter) || s.techs[t.id]),
};
export const gatePhase = (s) => LEGACY.gate[s.chapter].filter((p) => p.from <= s.legacy.ascensions).at(-1);
export const gateStatus = (s) => gatePhase(s).any.map((c) => ({ ...c, done: GATE[c.type](s, c) }));
export const gateMet = (s) => gateStatus(s).some((c) => c.done);

// Desafios e semente do dia (s.run) não ascendem: começam e terminam sem legado.
export const canAscend = (s) => !s.run && s.earned >= minRunEarned(s) && gateMet(s) && legacyGain(s) >= 1;

// Quanto falta ganhar nesta partida para a prévia subir mais 1 ponto.
export function nextPointIn(s) {
  const total = s.legacy.earned + legacyGain(s);
  return threshold(total + 1, chapterScale(s)) - lifetimeEarned(s);
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
  const { career, achievements, chapter, empire } = s;
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
  Object.assign(s, newState(rng), { legacy, career, achievements, chapter, empire });
  startRun(s);
  return gain;
}

// O que a loja entrega pronto no começo de cada partida (exportada para a colonização). A pesquisa vem como se tivesse
// sido concluída (sem custo nem ficha); automação herdada ou pesquisada já liga.
export function startRun(s) {
  // Começo Rápido dá unidades da 1ª fonte do capítulo. Fora da Terra, a partida já começa
  // com 1 unidade dela e a pesquisa que a libera (sem isso, não haveria renda nenhuma).
  const first = GENERATORS.find((g) => g.chapter === s.chapter);
  s.owned[first.id] = Math.max(shopValue(s, 'start', 0), s.chapter === 'earth' ? 0 : 1);
  if (first.unlock) s.techs[first.unlock] = true;
  // Capital Inicial (Patentes): a renda de segundos de 1 unidade da 1ª fonte.
  s.money += patentValue(s, 'capital', 0) * first.output;
  s.labs = shopPerk(s, 'lab').labs ?? 0;
  for (const id of [...shopValue(s, 'techs', []), ...(shopPerk(s, 'start').techs ?? [])]) s.techs[id] = true;
  for (const id of Object.keys(s.cooling)) s.cooling[id] = shopValue(s, 'cooling', 0);
  s.transformers = shopValue(s, 'transformers', 0);
  s.market.battery.banks = shopValue(s, 'banks', 0);
  if (shopValue(s, 'crew') !== null) s.wear.crew = true;
  rewardStart(s);
  const autoTech = TECHS.some((t) => t.type === 'auto' && s.techs[t.id]);
  if (autoTech || shopValue(s, 'auto') !== null) s.auto.buy = true;
}
