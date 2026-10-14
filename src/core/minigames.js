// Minijogos das crises como máquinas de estado puras: create(rand) -> jogo,
// step(jogo, dt), input(jogo, tecla, rand). Nada de terminal nem de relógio real, para a
// mesma lógica servir a uma futura versão web (só o desenho muda).
// `status`: 'playing' | 'won' | 'lost'. `last` = último feedback { ok, at } para a UI
// piscar acerto/erro.

const feedback = (g, ok) => { g.last = { ok, at: g.time }; };

// Barra de timing: o cursor corre da esquerda para a direita e recomeça; cada acerto
// estreita a faixa e acelera o cursor.
function newZone(rand, width) {
  return 0.1 + rand() * (0.85 - width);
}

const timing = {
  create: (rand) => ({
    kind: 'timing', status: 'playing', time: 0, last: null,
    pos: 0, speed: 0.55, width: 0.2, zone: newZone(rand, 0.2),
    hits: 0, need: 3, misses: 0, maxMisses: 3, timeLeft: 20,
  }),
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

// Alternar ← → enche a pressão, que vaza sozinha. Repetir a mesma seta não conta: segurar
// a tecla (auto-repeat do teclado) não resolve a crise por ninguém.
const mash = {
  create: () => ({
    kind: 'mash', status: 'playing', time: 0, last: null,
    fill: 0, gain: 0.08, leak: 0.2, timeLeft: 10, prev: null,
  }),
  step(g, dt) {
    g.time += dt;
    g.fill = Math.max(0, g.fill - g.leak * dt);
    g.timeLeft = Math.max(0, g.timeLeft - dt);
    if (g.timeLeft === 0 && g.status === 'playing') g.status = 'lost';
  },
  input(g, key) {
    if (key !== 'left' && key !== 'right') return false;
    const ok = key !== g.prev;
    feedback(g, ok);
    if (!ok) return true;
    g.prev = key;
    g.fill = Math.min(1, g.fill + g.gain);
    if (g.fill >= 1) g.status = 'won';
    return true;
  },
};

const ARROWS = ['up', 'right', 'down', 'left'];

const sequence = {
  create: (rand) => ({
    kind: 'sequence', status: 'playing', time: 0, last: null,
    seq: Array.from({ length: 6 }, () => ARROWS[Math.floor(rand() * 4)]),
    idx: 0, errors: 0, maxErrors: 3, timeLeft: 12,
  }),
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
