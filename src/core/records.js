// Estatísticas: duas fichas com o mesmo formato. `s.stats` é a partida atual (zera ao
// ascender); `s.career` soma todas as partidas. Todo registro vai para as duas, então
// quem registra nunca precisa saber qual ficha existe.
// Sem dependência do engine: engine, ações e eventos importam daqui sem ciclo.
import { GENERATORS } from '../data/generators.js';
import { EVENTS } from '../data/events.js';

const perGen = () => Object.fromEntries(GENERATORS.map((g) => [g.id, 0]));

export function newStats() {
  return {
    playTime: 0, offlineTime: 0,
    moneyEarned: 0, moneySpent: 0, upkeepPaid: 0, crankMoney: 0,
    energy: 0, excessEnergy: 0, crankEnergy: 0,
    rpEarned: 0, rpSpent: 0,
    peakKw: 0, peakIncome: 0, peakPrice: 0, peakMoney: 0,
    cranks: 0, crankBurst: 0,
    purchases: 0, bulkPurchases: 0, autoBought: 0, labsBought: 0,
    upgrades: 0, milestones: 0, techs: 0, cooling: 0, transformers: 0,
    batteryIn: 0, batteryOut: 0, batteryMoney: 0, banks: 0,
    contractsDone: 0, contractsFailed: 0, contractMoney: 0, contractRp: 0,
    bought: perGen(), produced: perGen(), shutdowns: perGen(),
    events: Object.fromEntries(EVENTS.map((e) => [e.id, 0])),
    crises: { won: 0, lost: 0, crew: 0, timeout: 0 },
    crewPaid: 0, rewards: 0, streak: 0, bestStreak: 0,
    // Menor tempo (s) de vitória em cada minijogo; null = nunca venceu.
    bestWin: { timing: null, mash: null, sequence: null, balance: null, shield: null },
    // Só fazem sentido na carreira, mas o formato igual simplifica tudo.
    fastestRun: null, bestGain: 0,
  };
}

const sheets = (s) => [s.stats, s.career];

export function add(s, key, n = 1, sub) {
  for (const st of sheets(s)) {
    if (sub === undefined) st[key] += n;
    else st[key][sub] = (st[key][sub] ?? 0) + n;
  }
}

export function peak(s, key, v) {
  for (const st of sheets(s)) if (v > st[key]) st[key] = v;
}

// Menor é melhor (tempos); null (ou ausente) conta como "sem recorde".
export function best(s, key, sub, v) {
  for (const st of sheets(s)) if (st[key][sub] == null || v < st[key][sub]) st[key][sub] = v;
}

// Giros por segundo: janela de 1 s de jogo, guardada fora das fichas (é transitória).
export function crankTap(s) {
  const w = (s.crankWindow ??= { at: s.t, n: 0 });
  if (s.t - w.at >= 1) { w.at = s.t; w.n = 0; }
  w.n++;
  peak(s, 'crankBurst', w.n);
}

// Mescla uma ficha salva com os padrões, campo a campo (fichas antigas não têm os novos).
export function mergeStats(base, raw) {
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(base)) {
    if (v && typeof v === 'object') out[k] = { ...v, ...raw[k] };
    else if (k in raw) out[k] = raw[k];
  }
  return out;
}

const okLeaf = (x) => x === null || (typeof x === 'number' && Number.isFinite(x) && x >= 0);
export function isValidStats(st) {
  if (!st || typeof st !== 'object') return false;
  return Object.values(st).every((v) => (v && typeof v === 'object' ? Object.values(v).every(okLeaf) : okLeaf(v)));
}
