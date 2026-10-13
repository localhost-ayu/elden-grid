// Este módulo NÃO importa o engine: quem chama passa o multiplicador de produção do
// gerador. Assim engine -> heat é uma dependência de mão única (sem ciclo de imports).
import { GENERATORS } from '../data/generators.js';
import { HEAT, COOLING } from '../data/heat.js';

const heatTrait = (g) => g.traits.find((tr) => tr.type === 'heat');
export const isHot = (g) => !!heatTrait(g);
export const HOT_GENERATORS = GENERATORS.filter(isHot);

export const coolingLevel = (s, g) => s.cooling[g.id] ?? 0;
export const coolingFactor = (s, g) => COOLING.factor ** coolingLevel(s, g);
export function nextCooling(s, g) {
  const lvl = coolingLevel(s, g);
  const def = COOLING.levels[lvl];
  return def ? { level: lvl + 1, name: def.name, cost: g.baseCost * def.costMult } : null;
}

// Sem unidades, o reator esfria até 0.
export function heatTarget(s, g, outputMult) {
  const tr = heatTrait(g);
  if (!tr || s.owned[g.id] < 1) return 0;
  return (tr.base * (1 + HEAT.intensity * Math.log2(Math.max(1, outputMult)))) / coolingFactor(s, g);
}

export const isShutdown = (s, g) => isHot(g) && s.t < (s.heat[g.id]?.off ?? 0);
export const shutdownLeft = (s, g) => Math.max(0, (s.heat[g.id]?.off ?? 0) - s.t);
export const heatLevel = (s, g) => s.heat[g.id]?.h ?? 0;

export function efficiency(h) {
  if (h <= HEAT.warnAt) return 1;
  const over = Math.min(1, (h - HEAT.warnAt) / (HEAT.shutdownAt - HEAT.warnAt));
  return 1 - HEAT.maxPenalty * over;
}

// Offline o calor não é simulado: usa a eficiência do alvo, limitada logo abaixo do
// desligamento — reator mal resfriado rende menos, mas o jogador não volta para uma
// sequência de desligamentos que não viu.
export function heatFactor(s, g, outputMult, average = false) {
  if (!isHot(g)) return 1;
  if (average) return efficiency(Math.min(heatTarget(s, g, outputMult), HEAT.shutdownAt - 1e-9));
  if (isShutdown(s, g)) return 0;
  return efficiency(heatLevel(s, g));
}

// Retorna os ids que acabaram de desligar (para a UI avisar).
export function heatStep(s, dt, outputMultOf) {
  const shut = [];
  const k = 1 - Math.exp(-dt / HEAT.tau); // aproximação exponencial: estável com qualquer dt
  for (const g of HOT_GENERATORS) {
    const st = (s.heat[g.id] ??= { h: 0, off: 0 });
    const target = isShutdown(s, g) ? 0 : heatTarget(s, g, outputMultOf(g));
    st.h += (target - st.h) * k;
    if (!isShutdown(s, g) && st.h >= HEAT.shutdownAt) {
      st.h = HEAT.shutdownAt;
      st.off = s.t + HEAT.shutdownSeconds;
      shut.push(g.id);
    }
  }
  return shut;
}
