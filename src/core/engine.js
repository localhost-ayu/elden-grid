// Lógica pura: nada de terminal nem de disco aqui, para poder testar sem TTY.
import { GENERATORS, LAB } from '../data/generators.js';
import { TECHS } from '../data/research.js';
import { GRID } from '../data/grid.js';
import { MILESTONES, UPGRADE_TRACK, UPGRADE_OVERRIDES, UPGRADE_NAMES } from '../data/upgrades.js';
import { envFactor } from './traits.js';
import { heatFactor, heatStep } from './heat.js';

export const bought = (s, id) => !!s.techs[id];

function mult(s, type, gen) {
  let m = 1;
  for (const t of TECHS) {
    if (bought(s, t.id) && t.type === type && (gen === undefined || t.gen === gen)) m *= t.mult;
  }
  return m;
}

const boughtOf = (s, type) => TECHS.filter((t) => t.type === type && bought(s, t.id));
// traits.js recebe as pesquisas já filtradas para não depender da árvore.
const traitCtx = (s) => ({ battery: boughtOf(s, 'battery') });

// `average` = média de longo prazo do ambiente, usada offline.
export const genEnv = (s, g, average = false) => envFactor(s, g, traitCtx(s), average);

export const upgradeTrack = (g) => UPGRADE_TRACK.map((lvl, i) => ({
  level: i + 1,
  name: UPGRADE_NAMES[g.id]?.[i] ?? `Nível ${i + 1}`,
  cost: g.baseCost * lvl.costMult,
  effects: UPGRADE_OVERRIDES[g.id]?.[i] ?? lvl.effects,
}));
export const upgradeLevel = (s, g) => s.upgrades[g.id] ?? 0;
export const nextUpgrade = (s, g) => upgradeTrack(g)[upgradeLevel(s, g)] ?? null;
export const nextMilestone = (s, g) => MILESTONES.find((m) => s.owned[g.id] < m.at) ?? null;

// Pesquisas, upgrades e marcos viram uma lista de { type, mult, source }; produção,
// custo e operação são o produto dos do tipo certo. Uma nova fonte de bônus é só mais
// itens na lista, sem `if` por gerador espalhado pelo engine.
export function genModifiers(s, g) {
  const mods = [];
  for (const t of TECHS) {
    if (t.type === 'genMult' && t.gen === g.id && bought(s, t.id)) mods.push({ type: 'output', mult: t.mult, source: t.name });
  }
  for (const u of upgradeTrack(g).slice(0, upgradeLevel(s, g))) {
    for (const e of u.effects) mods.push({ ...e, source: u.name });
  }
  for (const m of MILESTONES) {
    if (s.owned[g.id] >= m.at) mods.push({ type: 'output', mult: m.mult, source: `marco ${m.at}` });
  }
  return mods;
}
const modMult = (mods, type) => mods.reduce((m, x) => (x.type === type ? m * x.mult : m), 1);
export const genModMult = (s, g, type) => modMult(genModifiers(s, g), type);

// O multiplicador global entra em power(), uma vez só.
export function genPower(s, g, average = false) {
  if (!s.owned[g.id]) return 0;
  const out = genModMult(s, g, 'output');
  return s.owned[g.id] * g.output * out * genEnv(s, g, average) * heatFactor(s, g, out, average);
}
export const power = (s, average = false) =>
  GENERATORS.reduce((sum, g) => sum + genPower(s, g, average), 0) * mult(s, 'global');

export const genUpkeep = (g) => g.traits.reduce((sum, tr) => sum + (tr.type === 'upkeep' ? tr.money : 0), 0);
export const upkeep = (s) =>
  GENERATORS.reduce((sum, g) => sum + (genUpkeep(g) && s.owned[g.id] * genUpkeep(g) * genModMult(s, g, 'upkeep')), 0);
export const rpRate = (s) => s.labs * LAB.rpPerSec * mult(s, 'lab');
// Preço do kWh oscila ±20% numa senoide lenta (dá vida ao contador de dinheiro).
export const price = (s) => (1 + 0.2 * Math.sin(s.t / 15)) * mult(s, 'price');

export const capacity = (s) =>
  GRID.baseCapacity * mult(s, 'capacity') * GRID.transformer.capacityMult ** s.transformers;
export const transformerCost = (s) => Math.ceil(GRID.transformer.baseCost * GRID.transformer.growth ** s.transformers);

// { full, excess, perSecond }: kW a preço cheio, kW excedentes (com desconto) e $/s.
export function sales(s, kw) {
  const full = Math.min(kw, capacity(s));
  const excess = kw - full;
  return { full, excess, perSecond: (full + excess * GRID.excessPriceRate) * price(s) };
}
// Fração da capacidade em uso (1 = no limite; > 1 = saturada).
export const gridLoad = (s) => power(s) / capacity(s);

// Centralizada aqui para a UI não refazer a conta por conta própria.
export const income = (s) => sales(s, power(s)).perSecond - upkeep(s);

// Cada unidade é arredondada para cima individualmente (como no MVP), então o custo
// de um lote é a soma das unidades — comprar x10 custa exatamente o mesmo que 10 x1.
const unitCost = (base, growth, owned, m) => Math.ceil(base * growth ** owned * m);

export function seriesCost(base, growth, owned, n, m = 1) {
  let c = 0;
  for (let k = 0; k < n; k++) c += unitCost(base, growth, owned + k, m);
  return c;
}

// Quantas unidades cabem em `money`, e quanto custam. `cap` evita laço sem fim com
// dinheiro astronômico (o crescimento exponencial já limita a poucas centenas).
export function maxAffordable(base, growth, owned, money, m = 1, cap = 10000) {
  let n = 0;
  let cost = 0;
  while (n < cap) {
    const u = unitCost(base, growth, owned + n, m);
    if (cost + u > money) break;
    cost += u;
    n++;
  }
  return { n, cost };
}

// Com 'max' e saldo insuficiente, cost = preço de 1 (para a UI mostrar quanto falta).
// Com número, ok só se couber o lote inteiro.
function bulk(base, growth, owned, money, m, amount) {
  if (amount === 'max') {
    const r = maxAffordable(base, growth, owned, money, m);
    return r.n > 0 ? { ...r, ok: true } : { n: 0, cost: unitCost(base, growth, owned, m), ok: false };
  }
  const cost = seriesCost(base, growth, owned, amount, m);
  return { n: amount, cost, ok: money >= cost };
}

export const genCost = (s, g) => unitCost(g.baseCost, g.growth, s.owned[g.id], genModMult(s, g, 'cost'));
export const labCost = (s) => unitCost(LAB.baseCost, LAB.growth, s.labs, 1);
export const genBulk = (s, g, amount) => bulk(g.baseCost, g.growth, s.owned[g.id], s.money, genModMult(s, g, 'cost'), amount);
export const labBulk = (s, amount) => bulk(LAB.baseCost, LAB.growth, s.labs, s.money, 1, amount);
export const genAffordable = (s, g) => maxAffordable(g.baseCost, g.growth, s.owned[g.id], s.money, genModMult(s, g, 'cost')).n;
export const genUnlocked = (g, s) => g.unlock === null || bought(s, g.unlock);
export const labUnlocked = (s) => s.totalEnergy >= LAB.unlockAt || s.labs > 0;
export const techVisible = (t, s) => !bought(s, t.id) && t.req.every((r) => bought(s, r));

// `average` = médias do ambiente (offline); nesse modo o calor não é simulado.
// Retorna os ids de reatores que desligaram por superaquecimento.
export function tick(s, dt, average = false) {
  const shutdowns = average ? [] : heatStep(s, dt, (g) => genModMult(s, g, 'output'));
  const kw = power(s, average);
  s.totalEnergy += kw * dt;
  s.money += (sales(s, kw).perSecond - upkeep(s)) * dt;
  s.rp += rpRate(s) * dt;
  s.t += dt;
  return shutdowns;
}

// Retorna null se a ausência foi curta demais para valer a pena mostrar um resumo.
// `maxSeconds` é parâmetro para bônus permanentes poderem aumentar o teto.
export const OFFLINE_MAX_S = 3600;
export const OFFLINE_RATE = 0.5;
export const OFFLINE_MIN_S = 5;
export function applyOffline(s, awaySeconds, maxSeconds = OFFLINE_MAX_S) {
  if (!(awaySeconds > OFFLINE_MIN_S)) return null;
  const counted = Math.min(awaySeconds, maxSeconds);
  const before = { money: s.money, energy: s.totalEnergy, rp: s.rp };
  tick(s, counted * OFFLINE_RATE, true);
  return {
    away: awaySeconds, // tempo real fora
    counted,           // quanto disso valeu (limitado pelo teto)
    money: s.money - before.money,
    energy: s.totalEnergy - before.energy,
    rp: s.rp - before.rp,
  };
}
