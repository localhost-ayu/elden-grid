// Ações do jogador: validam, alteram o estado e retornam se deu certo (a UI decide a
// mensagem).
import { GENERATORS } from '../data/generators.js';
import { TECHS } from '../data/research.js';
import {
  power, price, genUnlocked, labUnlocked, techVisible, genBulk, labBulk, nextUpgrade, transformerCost,
} from './engine.js';
import { isHot, nextCooling } from './heat.js';

export function crank(s) {
  const e = Math.max(1, power(s) * 0.5);
  s.totalEnergy += e;
  s.money += e * price(s);
  return e;
}

// amount = 1 | 10 | 100 | 'max'. Retorna quantas unidades comprou (0 = nada).
export function buyGenBulk(s, id, amount = 1) {
  const g = GENERATORS.find((x) => x.id === id);
  if (!g || !genUnlocked(g, s)) return 0;
  const b = genBulk(s, g, amount);
  if (!b.ok) return 0;
  s.money -= b.cost;
  s.owned[id] += b.n;
  return b.n;
}

export function buyLabBulk(s, amount = 1) {
  if (!labUnlocked(s)) return 0;
  const b = labBulk(s, amount);
  if (!b.ok) return 0;
  s.money -= b.cost;
  s.labs += b.n;
  return b.n;
}

export const buyGen = (s, id) => buyGenBulk(s, id, 1) === 1;
export const buyLab = (s) => buyLabBulk(s, 1) === 1;

// Exige ter ao menos 1 unidade: melhorar uma usina que não existe não faz sentido.
export function buyUpgrade(s, id) {
  const g = GENERATORS.find((x) => x.id === id);
  if (!g || !genUnlocked(g, s) || s.owned[id] < 1) return false;
  const u = nextUpgrade(s, g);
  if (!u || s.money < u.cost) return false;
  s.money -= u.cost;
  s.upgrades[id] = u.level;
  return true;
}

export function buyTech(s, id) {
  const t = TECHS.find((x) => x.id === id);
  if (!t || !techVisible(t, s) || s.rp < t.cost) return false;
  s.rp -= t.cost;
  s.techs[id] = true;
  // Quem pesquisa automação quer usá-la: já começa ligada (A desliga na aba Geradores).
  if (t.type === 'auto') s.auto.buy = true;
  return true;
}

export function buyCooling(s, id) {
  const g = GENERATORS.find((x) => x.id === id);
  if (!g || !isHot(g) || s.owned[id] < 1) return false;
  const c = nextCooling(s, g);
  if (!c || s.money < c.cost) return false;
  s.money -= c.cost;
  s.cooling[id] = c.level;
  return true;
}

export function buyTransformer(s) {
  const c = transformerCost(s);
  if (s.money < c) return false;
  s.money -= c;
  s.transformers++;
  return true;
}
