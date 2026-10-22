// O estado é JSON puro para poder ser salvo/carregado sem perdas.
import { GENERATORS } from '../data/generators.js';
import { newMarket } from './market.js';
import { SCHEDULE } from '../data/events.js';
import { newStats, mergeStats, isValidStats } from './records.js';

const HOT = GENERATORS.filter((g) => g.traits.some((tr) => tr.type === 'heat')).map((g) => g.id);
const hotDefaults = (make) => Object.fromEntries(HOT.map((id) => [id, make()]));

// `seed` alimenta o sorteio dos eventos (core/events.js).
export function newState(seed = 1) {
  return {
    money: 0,
    totalEnergy: 0, // kWh produzidos desde o início
    rp: 0,
    owned: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    labs: 0,
    techs: {},
    upgrades: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
    auto: { buy: false, clock: 0, crank: 0 }, // crank = relógio da manivela automática
    heat: hotDefaults(() => ({ h: 0, off: 0 })), // off = desligado até s.t
    cooling: hotDefaults(() => 0),
    transformers: 0,
    t: 0,           // tempo de jogo em segundos
    earned: 0,      // dinheiro ganho nesta partida (base do Legado; gastar não desconta)
    // Sobrevive à ascensão. earned = pontos já recebidos; points = não gastos.
    legacy: { points: 0, earned: 0, lifetime: 0, ascensions: 0, shop: {}, monument: 0 },
    achievements: {}, // { id: tempo de jogo da carreira ao conquistar } — sobrevive à ascensão
    // Partida especial do slot de Desafio: { challenge, tier } ou { daily: 'AAAA-MM-DD' }.
    // null = partida normal (slots 1–3).
    run: null,
    // effects: [{ id, until }] (until null = crise em aberto); crisis: { id, deadline, game }
    events: { rng: seed >>> 0, next: SCHEDULE.first, effects: [], crisis: null, seen: 0 },
    market: newMarket(seed >>> 0), // demanda, surtos e impacto das vendas no preço
    stats: newStats(),  // esta partida
    career: newStats(), // todas as partidas (sobrevive à ascensão)
  };
}

// Saves antigos sobem degrau por degrau (vN -> vN+1), então nunca é preciso converter
// direto de uma versão muito velha para a atual.
//   v1 = estado "achatado" + savedAt, sem saveVersion (~/.reactor-ascii.json)
//   v2 = envelope { saveVersion, savedAt, state }
//   v3 = state.upgrades
//   v4 = state.auto
//   v5 = state.heat, state.cooling, state.transformers
//   v6 = state.earned, state.legacy
//   v7 = state.events
//   v8 = state.stats, state.career
//   v9 = state.achievements, state.legacy.monument, state.auto.crank (fromSave preenche)
//   v10 = state.run (fromSave preenche com null)
//   v11 = pontos de legado pela raiz cúbica: legacy.lifetime é reajustado à curva nova
//   v12 = state.market (fromSave preenche)
export const SAVE_VERSION = 12;

const MIGRATIONS = {
  1: (raw) => {
    const { savedAt, ...state } = raw;
    return { saveVersion: 2, savedAt: savedAt ?? null, state };
  },
  2: (raw) => ({ ...raw, saveVersion: 3, state: { ...raw.state, upgrades: raw.state?.upgrades ?? {} } }),
  3: (raw) => ({ ...raw, saveVersion: 4, state: { ...raw.state, auto: raw.state?.auto ?? { buy: false, clock: 0 } } }),
  // Campos novos ficam ausentes; fromSave() preenche com os padrões (reatores frios).
  4: (raw) => ({ ...raw, saveVersion: 5 }),
  // Saves antigos não registravam o ganho; o saldo atual é o mínimo que se sabe ter ganho.
  5: (raw) => ({ ...raw, saveVersion: 6, state: { ...raw.state, earned: raw.state?.earned ?? Math.max(0, raw.state?.money ?? 0) } }),
  // O momento do save serve de seed: saves diferentes não sorteiam os mesmos eventos.
  6: (raw) => ({ ...raw, saveVersion: 7, state: { ...raw.state, events: raw.state?.events ?? newState(raw.savedAt ?? 1).events } }),
  // Fichas começam com o pouco que o save antigo já sabia (ganho e energia).
  7: (raw) => {
    const st = raw.state ?? {};
    const known = { energy: st.totalEnergy ?? 0, moneyEarned: st.earned ?? 0 };
    const career = { ...known, moneyEarned: (st.legacy?.lifetime ?? 0) + known.moneyEarned };
    return { ...raw, saveVersion: 8, state: { ...st, stats: { ...newStats(), ...known }, career: { ...newStats(), ...career } } };
  },
  // Conquistas começam vazias: o que o save antigo já cumpre sai no primeiro quadro.
  8: (raw) => ({ ...raw, saveVersion: 9, state: { ...raw.state, achievements: raw.state?.achievements ?? {} } }),
  9: (raw) => ({ ...raw, saveVersion: 10 }),
  // 1.4: pontos = cbrt(total / 5e7) em vez de sqrt(total / 1e9). Quem já ascendeu mantém
  // os pontos recebidos (legacy.earned); o total ganho passa a ser o mínimo que dá esses
  // pontos na curva nova, para o próximo ponto não ficar centenas de vezes mais longe.
  // Números fixos aqui (e não LEGACY): a migração é da curva da 1.4, mesmo se ela mudar.
  10: (raw) => {
    const L = raw.state?.legacy;
    if (!L || !(L.earned > 0)) return { ...raw, saveVersion: 11 };
    return { ...raw, saveVersion: 11, state: { ...raw.state, legacy: { ...L, lifetime: L.earned ** 3 * 5e7 } } };
  },
  11: (raw) => ({ ...raw, saveVersion: 12 }),
};

// Lança erro se não for um save: o storage trata isso como arquivo corrompido.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('save não é um objeto');
  let v = raw.saveVersion ?? 1;
  if (!Number.isInteger(v) || v < 1) throw new Error(`saveVersion inválida: ${v}`);
  if (v > SAVE_VERSION) throw new Error(`save da versão ${v}, mais nova que este jogo (${SAVE_VERSION})`);
  let cur = raw;
  while (v < SAVE_VERSION) {
    cur = MIGRATIONS[v](cur);
    v = cur.saveVersion;
  }
  return cur;
}

export const toSave = (state, now) => ({ saveVersion: SAVE_VERSION, savedAt: now, state });

// Mescla com os padrões para que um save sem algum campo/gerador novo continue carregando.
export function fromSave(raw) {
  const base = newState();
  const s = { ...base, ...raw };
  s.owned = { ...base.owned, ...raw.owned };
  s.upgrades = { ...base.upgrades, ...raw.upgrades };
  s.auto = { ...base.auto, ...raw.auto };
  s.heat = { ...base.heat, ...raw.heat };
  s.cooling = { ...base.cooling, ...raw.cooling };
  s.legacy = { ...base.legacy, ...raw.legacy, shop: { ...raw.legacy?.shop } };
  s.achievements = { ...raw.achievements };
  s.events = { ...base.events, ...raw.events };
  s.market = { ...base.market, ...raw.market, battery: { ...base.market.battery, ...raw.market?.battery } };
  s.stats = mergeStats(base.stats, raw.stats);
  s.career = mergeStats(base.career, raw.career);
  // Um minijogo pela metade não sobrevive ao save: a crise volta ao alerta.
  if (s.events.crisis) s.events.crisis = { ...s.events.crisis, game: null };
  delete s.savedAt; // metadado do arquivo, não do jogo
  return s;
}

const isValidRun = (r) => !!r && typeof r === 'object' && (r.done === undefined || typeof r.done === 'boolean') &&
  ((typeof r.challenge === 'string' && Number.isInteger(r.tier) && r.tier >= 1 && r.tier <= 5) ||
    (typeof r.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.daily)));

// Um NaN/Infinity gravado "envenenaria" o save para sempre, então estados inválidos
// não são gravados nem aceitos ao carregar.
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const count = (x) => Number.isInteger(x) && x >= 0;
export function isValidState(s) {
  if (!s || typeof s !== 'object') return false;
  if (!finite(s.money) || !finite(s.totalEnergy) || !finite(s.rp) || !finite(s.t)) return false;
  if (s.totalEnergy < 0 || s.rp < 0 || s.t < 0 || !count(s.labs)) return false;
  if (!s.owned || typeof s.owned !== 'object' || !Object.values(s.owned).every(count)) return false;
  if (!s.upgrades || typeof s.upgrades !== 'object' || !Object.values(s.upgrades).every(count)) return false;
  if (!s.auto || typeof s.auto.buy !== 'boolean' || !finite(s.auto.clock) || s.auto.clock < 0) return false;
  if (!finite(s.auto.crank) || s.auto.crank < 0) return false;
  if (!s.heat || !Object.values(s.heat).every((x) => x && finite(x.h) && x.h >= 0 && finite(x.off))) return false;
  if (!s.cooling || !Object.values(s.cooling).every(count) || !count(s.transformers)) return false;
  if (!finite(s.earned) || s.earned < 0) return false;
  const L = s.legacy;
  if (!L || !count(L.points) || !count(L.earned) || !count(L.ascensions) || !count(L.monument) || !finite(L.lifetime) || L.lifetime < 0) return false;
  if (!L.shop || typeof L.shop !== 'object' || !Object.values(L.shop).every(count)) return false;
  if (!isValidStats(s.stats) || !isValidStats(s.career)) return false;
  if (!s.achievements || typeof s.achievements !== 'object' || !Object.values(s.achievements).every((t) => finite(t) && t >= 0)) return false;
  const ev = s.events;
  if (!ev || !Number.isInteger(ev.rng) || ev.rng < 0 || ev.rng > 0xffffffff || !finite(ev.next) || !count(ev.seen)) return false;
  if (!Array.isArray(ev.effects) || !ev.effects.every((a) => a && typeof a.id === 'string' && (a.until === null || finite(a.until)))) return false;
  if (ev.crisis !== null && !(ev.crisis && typeof ev.crisis.id === 'string' && finite(ev.crisis.deadline))) return false;
  if (s.run !== null && !isValidRun(s.run)) return false;
  const m = s.market;
  if (!m || !Number.isInteger(m.rng) || m.rng < 0 || m.rng > 0xffffffff) return false;
  if (![m.demand, m.target, m.retarget, m.surgeUntil, m.impact].every(finite) || m.impact < 0 || m.demand <= 0) return false;
  const b = m.battery;
  if (!b || !finite(b.kwh) || b.kwh < 0 || !count(b.banks) || typeof b.cheap !== 'boolean' || typeof b.auto !== 'boolean') return false;
  return !!s.techs && typeof s.techs === 'object';
}
