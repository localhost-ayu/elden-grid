// Árvore de Patentes (2.0): compras com Patentes que valem em todos os capítulos. Só lê
// `s.empire`; fica separada de empire.js para prestige.js consultar sem ciclo de imports.
import { PATENT_TREE } from '../data/empire.js';

export const treeLevel = (s, item) => s.empire.tree[item.id] ?? 0;
export const nextTreeCost = (s, item) => item.costs[treeLevel(s, item)] ?? null;
export function patentValue(s, type, fallback = null) {
  const item = PATENT_TREE.find((x) => x.type === type);
  const lvl = item ? treeLevel(s, item) : 0;
  return lvl ? item.values[lvl - 1] : fallback;
}
export function buyPatent(s, id) {
  const item = PATENT_TREE.find((x) => x.id === id);
  const cost = item && nextTreeCost(s, item);
  if (cost == null || s.empire.patents < cost) return false;
  s.empire.patents -= cost;
  s.empire.tree[id] = treeLevel(s, item) + 1;
  return true;
}
