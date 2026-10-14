// O estado é JSON puro para poder ser salvo/carregado sem perdas.
import { GENERATORS } from '../data/generators.js';
import { SCHEDULE } from '../data/events.js';

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
    auto: { buy: false, clock: 0 },
    heat: hotDefaults(() => ({ h: 0, off: 0 })), // off = desligado até s.t
    cooling: hotDefaults(() => 0),
    transformers: 0,
    t: 0,           // tempo de jogo em segundos
    earned: 0,      // dinheiro ganho nesta partida (base do Legado; gastar não desconta)
    // Sobrevive à ascensão. earned = pontos já recebidos; points = não gastos.
    legacy: { points: 0, earned: 0, lifetime: 0, ascensions: 0, shop: {} },
    // effects: [{ id, until }] (until null = crise em aberto); crisis: { id, deadline, game }
    events: { rng: seed >>> 0, next: SCHEDULE.first, effects: [], crisis: null, seen: 0 },
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
export const SAVE_VERSION = 7;

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
  s.events = { ...base.events, ...raw.events };
  // Um minijogo pela metade não sobrevive ao save: a crise volta ao alerta.
  if (s.events.crisis) s.events.crisis = { ...s.events.crisis, game: null };
  delete s.savedAt; // metadado do arquivo, não do jogo
  return s;
}

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
  if (!s.heat || !Object.values(s.heat).every((x) => x && finite(x.h) && x.h >= 0 && finite(x.off))) return false;
  if (!s.cooling || !Object.values(s.cooling).every(count) || !count(s.transformers)) return false;
  if (!finite(s.earned) || s.earned < 0) return false;
  const L = s.legacy;
  if (!L || !count(L.points) || !count(L.earned) || !count(L.ascensions) || !finite(L.lifetime) || L.lifetime < 0) return false;
  if (!L.shop || typeof L.shop !== 'object' || !Object.values(L.shop).every(count)) return false;
  const ev = s.events;
  if (!ev || !Number.isInteger(ev.rng) || ev.rng < 0 || ev.rng > 0xffffffff || !finite(ev.next) || !count(ev.seen)) return false;
  if (!Array.isArray(ev.effects) || !ev.effects.every((a) => a && typeof a.id === 'string' && (a.until === null || finite(a.until)))) return false;
  if (ev.crisis !== null && !(ev.crisis && typeof ev.crisis.id === 'string' && finite(ev.crisis.deadline))) return false;
  return !!s.techs && typeof s.techs === 'object';
}
