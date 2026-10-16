// Minijogos das crises como máquinas de estado puras: create(rand, level) -> jogo,
// step(jogo, dt), input(jogo, tecla, rand). Nada de terminal nem de relógio real, para a
// mesma lógica servir a uma futura versão web (só o desenho muda).
// `status`: 'playing' | 'won' | 'lost'. `last` = último feedback { ok, at } para a UI
// piscar acerto/erro. `level` (0 a CRISIS.maxLevel) escolhe os parâmetros em
// DIFFICULTY (data/events.js).
import { CRISIS, DIFFICULTY } from '../data/events.js';

// Parâmetro [nível 0, nível máximo] no nível pedido.
const lerp = ([a, b], level) => a + (b - a) * Math.min(1, Math.max(0, level / CRISIS.maxLevel));
const int = (range, level) => Math.round(lerp(range, level));
// Regra que só liga a partir do nível `from`: `value` vai de [nível from, nível máximo].
const from = (rule, level) => (level < rule.from ? null
  : rule.value[0] + (rule.value[1] - rule.value[0]) * (level - rule.from) / Math.max(1, CRISIS.maxLevel - rule.from));

const feedback = (g, ok) => { g.last = { ok, at: g.time }; };

// Barra de timing: o cursor corre da esquerda para a direita e recomeça; cada acerto
// estreita a faixa e acelera o cursor.
function newZone(rand, width) {
  return 0.1 + rand() * (0.85 - width);
}

const timing = {
  create(rand, level = 0) {
    const D = DIFFICULTY.timing;
    const width = lerp(D.width, level);
    return {
      kind: 'timing', status: 'playing', time: 0, last: null,
      pos: 0, speed: lerp(D.speed, level), width, zone: newZone(rand, width),
      hits: 0, need: int(D.need, level), misses: 0, maxMisses: int(D.maxMisses, level), timeLeft: lerp(D.timeLeft, level),
    };
  },
  step(g, dt) {
    g.time += dt;
    g.pos = (g.pos + g.speed * dt) % 1;
    g.timeLeft = Math.max(0, g.timeLeft - dt);
    if (g.timeLeft === 0 && g.status === 'playing') g.status = 'lost';
  },
  input(g, key, rand) {
    if (key !== 'space' && key !== 'enter') return false;
    const inside = g.pos >= g.zone && g.pos <= g.zone + g.width;
    feedback(g, inside);
    if (inside) {
      g.hits++;
      g.width *= 0.8;
      g.speed *= 1.2;
      g.zone = newZone(rand, g.width);
      if (g.hits >= g.need) g.status = 'won';
    } else if (++g.misses >= g.maxMisses) {
      g.status = 'lost';
    }
    return true;
  },
};

// Válvula de pressão: alternar ← → sobe a pressão, que vaza sozinha. Resolve quem segura
// o ponteiro na faixa por `hold` s (somados); chegar a 1 estoura a válvula (erro) e a
// pressão cai. Repetir a mesma seta não conta (segurar a tecla não resolve), e martelar
// as setas estoura: o que vale é o ritmo. Nos níveis altos a faixa oscila.
const BURST_FILL = 0.3;
const CENTER = 0.6;
const mash = {
  create(rand, level = 0) {
    const D = DIFFICULTY.mash;
    return {
      kind: 'mash', status: 'playing', time: 0, last: null, prev: null,
      fill: 0, gain: lerp(D.gain, level), leak: lerp(D.leak, level),
      band: lerp(D.band, level), center: CENTER, drift: from(D.drift, level) ?? 0,
      held: 0, hold: lerp(D.hold, level), bursts: 0, maxBursts: int(D.maxBursts, level), timeLeft: lerp(D.timeLeft, level),
    };
  },
  step(g, dt) {
    g.time += dt;
    g.fill = Math.max(0, g.fill - g.leak * dt);
    g.center = CENTER + g.drift * Math.sin(g.time * 0.9);
    if (g.status === 'playing' && inBand(g)) {
      g.held += dt;
      if (g.held >= g.hold) g.status = 'won';
    }
    g.timeLeft = Math.max(0, g.timeLeft - dt);
    if (g.timeLeft === 0 && g.status === 'playing') g.status = 'lost';
  },
  input(g, key) {
    if (key !== 'left' && key !== 'right') return false;
    const ok = key !== g.prev;
    if (!ok) { feedback(g, false); return true; }
    g.prev = key;
    g.fill += g.gain;
    if (g.fill < 1) { feedback(g, true); return true; }
    g.fill = BURST_FILL;
    g.burst = g.time; // a UI mostra "estourou!"
    feedback(g, false);
    if (++g.bursts >= g.maxBursts) g.status = 'lost';
    return true;
  },
};
export const bandEdges = (g) => [g.center - g.band / 2, g.center + g.band / 2];
export const inBand = (g) => { const [lo, hi] = bandEdges(g); return g.fill >= lo && g.fill <= hi; };

const ARROWS = ['up', 'right', 'down', 'left'];

// `hideAt` (níveis altos): a partir desse tempo as setas ainda não digitadas somem.
const sequence = {
  create(rand, level = 0) {
    const D = DIFFICULTY.sequence;
    const hide = from(D.hide, level);
    return {
      kind: 'sequence', status: 'playing', time: 0, last: null,
      seq: Array.from({ length: int(D.length, level) }, () => ARROWS[Math.floor(rand() * 4)]),
      idx: 0, errors: 0, maxErrors: int(D.maxErrors, level), timeLeft: lerp(D.timeLeft, level), hideAt: hide,
    };
  },
  step(g, dt) {
    g.time += dt;
    g.timeLeft = Math.max(0, g.timeLeft - dt);
    if (g.timeLeft === 0 && g.status === 'playing') g.status = 'lost';
  },
  input(g, key) {
    if (!ARROWS.includes(key)) return false;
    const ok = key === g.seq[g.idx];
    feedback(g, ok);
    if (ok && ++g.idx >= g.seq.length) g.status = 'won';
    if (!ok && ++g.errors >= g.maxErrors) g.status = 'lost';
    return true;
  },
};

export const MINIGAMES = { timing, mash, sequence };
