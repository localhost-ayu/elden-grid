// Mercado: demanda, surtos e impacto das vendas no preço. Não importa o engine (o engine
// consulta marketFactor daqui), e quem vende passa a profundidade do mercado.
import { MARKET, BATTERY, REPUTATION } from '../data/market.js';
import { GENERATORS } from '../data/generators.js';
import { wearFactor } from './wear.js';
import { rules } from './challenges.js';

// mulberry32 com o estado em s.market.rng (separado da sorte dos eventos). Exportada
// para os contratos usarem a mesma sorte.
export function rand(s) {
  let t = (s.market.rng = (s.market.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const between = (s, [a, b]) => a + (b - a) * rand(s);

export const newMarket = (seed) => ({
  rng: (seed ^ 0x9e3779b9) >>> 0,
  demand: 1, target: 1, retarget: MARKET.demand.every[0], surgeUntil: 0,
  impact: 0,
  battery: { kwh: 0, banks: 0, cheap: false, auto: false },
  // offers: ofertas na mesa; active: contrato em andamento (ver core/contracts.js).
  contracts: { offers: [], active: null, next: 0, done: 0, failed: 0 },
  rep: 0, careClock: 0, // reputação e o relógio da avaliação das usinas
});

// ---- reputação ----
export const repTier = (s) => REPUTATION.tiers.filter((t) => s.market.rep >= t.at).length - 1;
export const repName = (s) => REPUTATION.tiers[repTier(s)].name;
export const nextTier = (s) => REPUTATION.tiers[repTier(s) + 1] ?? null;
export const contractBonus = (s) => 1 + REPUTATION.rewardPerTier * repTier(s);
export function addRep(s, n) {
  const before = repTier(s);
  s.market.rep = Math.max(0, Math.min(REPUTATION.max, s.market.rep + n));
  return repTier(s) - before; // > 0: subiu de faixa
}

// Avaliação periódica das usinas (eficiência média sem pesar a produção, e quebras
// esquecidas). Retorna a mudança de faixa (para a UI avisar) ou 0.
function care(s, dt) {
  const m = s.market;
  m.careClock += dt;
  if (m.careClock < REPUTATION.careEvery) return 0;
  m.careClock = 0;
  const own = GENERATORS.filter((g) => s.owned[g.id] > 0);
  if (!own.length) return 0;
  const avg = own.reduce((sum, g) => sum + wearFactor(s, g), 0) / own.length;
  const neglected = s.wear.broken.some((b) => s.t - b.at > REPUTATION.neglectAfter);
  return addRep(s, (avg >= REPUTATION.careAt ? REPUTATION.care : 0) - (neglected ? REPUTATION.neglect : 0));
}

export const surging = (s) => s.t < s.market.surgeUntil;

// x no preço: demanda (ou surto) sobre o impacto das vendas. Offline (average) é neutro.
export function marketFactor(s, average = false) {
  if (average) return 1;
  const m = s.market;
  const demand = surging(s) ? MARKET.surge.mult * rules(s).surge : m.demand;
  return demand * (1 + REPUTATION.pricePerTier * repTier(s)) / (1 + m.impact);
}

// Avança demanda e impacto. Retorna 'surge' quando um surto começa (a UI avisa).
export function marketStep(s, dt) {
  const m = s.market;
  const D = MARKET.demand;
  let note = null;
  m.impact *= 0.5 ** (dt / MARKET.impact.halfLife);
  if (m.impact < 1e-6) m.impact = 0;
  if (s.t >= m.retarget) {
    // Mercado Volátil (desafio) abre a faixa da demanda e torna os surtos mais comuns.
    const vol = rules(s).volatility;
    const mid = (D.min + D.max) / 2;
    m.target = mid + (between(s, [D.min, D.max]) - mid) * vol;
    m.retarget = s.t + between(s, D.every);
    if (rand(s) < MARKET.surge.chance * vol) {
      m.surgeUntil = s.t + between(s, MARKET.surge.duration);
      note = 'surge';
    }
  }
  m.demand += (m.target - m.demand) * (1 - Math.exp(-dt / D.tau));
  const tier = care(s, dt);
  if (tier > 0) note ??= 'rep';
  return note;
}

// Registra uma venda de `kwh` num mercado de profundidade `depthKwh` (a capacidade da
// rede vezes depthSeconds, calculada por quem vende).
export function addImpact(s, kwh, depthKwh) {
  if (depthKwh > 0) s.market.impact += kwh / depthKwh;
}

// ---- baterias ----
export const batteryCap = (s, capacityKw) => s.market.battery.banks * BATTERY.bankSeconds * capacityKw;
export const bankCost = (s) => Math.ceil(BATTERY.baseCost * BATTERY.growth ** s.market.battery.banks);
export const canBuyBank = (s) => s.market.battery.banks < BATTERY.maxBanks;
