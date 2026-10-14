// Auto-compra do gerador mais barato. Fica fora de actions.js porque roda sozinha a
// cada quadro (como o tick), e fora do engine porque usa as ações de compra.
import { GENERATORS } from '../data/generators.js';
import { TECHS } from '../data/research.js';
import { bought, genCost, genUnlocked } from './engine.js';
import { buyGen } from './actions.js';
import { shopValue } from './prestige.js';
import { add } from './records.js';

// A automação mais rápida (pesquisa ou Legado) vence; null = nenhuma disponível.
export function autoInterval(s) {
  const iv = TECHS.filter((t) => t.type === 'auto' && bought(s, t.id)).map((t) => t.interval);
  const heirloom = shopValue(s, 'auto');
  if (heirloom !== null) iv.push(heirloom);
  return iv.length ? Math.min(...iv) : null;
}
export const autoAvailable = (s) => autoInterval(s) !== null;

export function cheapestGen(s) {
  let best = null;
  for (const g of GENERATORS) {
    if (genUnlocked(g, s) && (!best || genCost(s, g) < genCost(s, best))) best = g;
  }
  return best;
}

// Limite de compras por chamada: um quadro atrasado (dt grande) não pode virar uma
// rajada de centenas de compras de uma vez.
const MAX_PER_STEP = 50;

// Não roda offline: o progresso offline só produz (ver engine.applyOffline).
export function autoStep(s, dt) {
  const iv = autoInterval(s);
  if (iv === null || !s.auto.buy) return 0;
  s.auto.clock += dt;
  let n = 0;
  while (s.auto.clock >= iv && n < MAX_PER_STEP) {
    s.auto.clock -= iv;
    const g = cheapestGen(s);
    if (!g || !buyGen(s, g.id)) { s.auto.clock = 0; break; } // sem saldo: espera o próximo ciclo
    n++;
  }
  if (n === MAX_PER_STEP) s.auto.clock = 0;
  if (n) add(s, 'autoBought', n);
  return n;
}

export function toggleAuto(s) {
  if (!autoAvailable(s)) return false;
  s.auto.buy = !s.auto.buy;
  return true;
}
