// Contratos de fornecimento: ofertas sorteadas com a sorte do mercado, um contrato ativo
// por vez. Cada tipo mede o progresso desde o aceite (produção, faturamento) ou uma
// condição que precisa valer o tempo todo (fração renovável, reator sem desligar).
import { CONTRACTS, CONTRACT_RULES, CONTRACT_REWARD, GREEN } from '../data/contracts.js';
import { GENERATORS } from '../data/generators.js';
import { power, genPower, income, rpRate } from './engine.js';
import { HOT_GENERATORS, heatLevel } from './heat.js';
import { rand, between, addRep, contractBonus } from './market.js';
import { REPUTATION } from '../data/market.js';
import { add } from './records.js';

const book = (s) => s.market.contracts;
const shutdowns = (s) => Object.values(s.stats.shutdowns).reduce((a, b) => a + b, 0);

export function greenShare(s) {
  const total = GENERATORS.reduce((sum, g) => sum + genPower(s, g), 0);
  if (total <= 0) return 0;
  return GENERATORS.filter((g) => GREEN.includes(g.id)).reduce((sum, g) => sum + genPower(s, g), 0) / total;
}

const hotReactor = (s) => HOT_GENERATORS.some((g) => s.owned[g.id] > 0 && heatLevel(s, g) > 0.5);

// Tipos que fazem sentido agora (Verde precisa de algo não renovável para segurar;
// Firme, de reator quente).
function eligible(s) {
  return Object.entries(CONTRACTS).filter(([id]) => {
    if (id === 'green') return greenShare(s) + CONTRACTS.green.gap <= CONTRACTS.green.cap;
    if (id === 'firm') return hotReactor(s);
    if (id === 'sales') return income(s) > 0;
    return power(s) > 0;
  });
}

function makeOffer(s) {
  const list = eligible(s);
  if (!list.length) return null;
  let r = rand(s) * list.reduce((sum, [, c]) => sum + c.weight, 0);
  const [type, def] = list.find(([, c]) => (r -= c.weight) < 0) ?? list.at(-1);
  const duration = Math.round(between(s, def.duration));
  const offer = { type, duration, expires: s.t + CONTRACT_RULES.expires };
  if (type === 'delivery') offer.target = power(s) * duration * between(s, def.goal);
  if (type === 'sales') offer.target = income(s) * duration * between(s, def.goal);
  if (type === 'green') offer.target = Math.min(def.cap, greenShare(s) + def.gap);
  // A reputação aumenta o prêmio (fixado na oferta).
  const rp = rpRate(s) > 0 && rand(s) < CONTRACT_REWARD.rpChance;
  const bonus = def.bonus * contractBonus(s);
  offer.reward = rp
    ? { rp: rpRate(s) * between(s, CONTRACT_REWARD.rp) * bonus }
    : { money: Math.max(1, income(s)) * between(s, CONTRACT_REWARD.money) * bonus };
  return offer;
}

// Progresso de 0 a 1 do contrato ativo (as condições contínuas mostram o tempo cumprido).
export function progress(s) {
  const a = book(s).active;
  if (!a) return 0;
  if (a.type === 'delivery') return Math.min(1, (s.totalEnergy - a.base) / a.target);
  if (a.type === 'sales') return Math.min(1, (s.earned - a.base) / a.target);
  return Math.min(1, (s.t - a.start) / a.duration);
}

export function accept(s, i) {
  const c = book(s);
  const o = c.offers[i];
  if (!o || c.active) return false;
  c.offers.splice(i, 1);
  const base = o.type === 'delivery' ? s.totalEnergy : o.type === 'sales' ? s.earned : o.type === 'firm' ? shutdowns(s) : 0;
  c.active = { ...o, start: s.t, deadline: s.t + o.duration, base };
  delete c.active.expires;
  return true;
}

export function abandon(s) {
  const c = book(s);
  if (!c.active) return false;
  c.active = null;
  c.failed++;
  add(s, 'contractsFailed');
  addRep(s, -REPUTATION.contractLost);
  return true;
}

function pay(s, reward) {
  if (reward.money) { s.money += reward.money; s.earned += reward.money; add(s, 'contractMoney', reward.money); }
  if (reward.rp) { s.rp += reward.rp; add(s, 'contractRp', reward.rp); }
}

// Avança ofertas e o contrato ativo. Retorna notas para a UI: offer, won, lost.
export function contractsStep(s) {
  const c = book(s);
  const notes = [];
  c.offers = c.offers.filter((o) => o.expires > s.t);
  if (s.stats.playTime >= CONTRACT_RULES.firstAt && s.t >= c.next) {
    c.next = s.t + CONTRACT_RULES.every;
    if (c.offers.length < CONTRACT_RULES.offers) {
      const o = makeOffer(s);
      if (o) { c.offers.push(o); notes.push({ type: 'offer', offer: o }); }
    }
  }
  const a = c.active;
  if (!a) return notes;
  let failed = false;
  if (a.type === 'green' && greenShare(s) < a.target) failed = true;
  if (a.type === 'firm' && shutdowns(s) > a.base) failed = true;
  const done = !failed && (a.type === 'delivery' || a.type === 'sales' ? progress(s) >= 1 : s.t >= a.deadline);
  if (done) {
    pay(s, a.reward);
    c.active = null;
    c.done++;
    add(s, 'contractsDone');
    const up = addRep(s, REPUTATION.contractWon);
    notes.push({ type: 'won', contract: a, up });
  } else if (failed || s.t >= a.deadline) {
    c.active = null;
    c.failed++;
    add(s, 'contractsFailed');
    addRep(s, -REPUTATION.contractLost);
    notes.push({ type: 'lost', contract: a });
  }
  return notes;
}

// Tempo parado (offline, disfarce): ofertas e o contrato ativo não correm.
export function holdContracts(s, dt) {
  const c = book(s);
  c.next += dt;
  for (const o of c.offers) o.expires += dt;
  if (c.active) { c.active.deadline += dt; c.active.start += dt; }
}
