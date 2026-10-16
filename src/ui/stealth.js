// Modo disfarce: a tela inteira vira algo que parece trabalho (um terminal comum) até o
// jogador apertar a tecla de novo. Não toca o terminal: guarda linhas como segmentos
// [estilo, texto] e o app desenha; o tempo (`now`) e a sorte (`rng`) vêm de fora.
//
//   build  testes em modo watch: uma rodada completa e, de tempos em tempos, um RERUN
//   logs   tail -f de um servidor: requisições, banco, filas, um WARN de vez em quando
//   shell  prompt vazio que aceita digitação (Enter responde como um shell de verdade)
//
// Nada aqui pode lembrar o jogo: nomes, cores e textos são de um projeto qualquer.
import { C, paint } from './theme.js';

// Estilos são nomes do tema ('green bold'), resolvidos só na hora de pintar: assim a
// troca de cores nas Opções vale também para as linhas que já estavam na tela.
const style = (names) => names.split(' ').map((n) => C[n] ?? '').join('');

export const DISGUISES = ['build', 'logs', 'shell'];
export const STEALTH_KEY = '\\';

const MAX_LINES = 300;
const BLINK_MS = 530;

const FILES = [
  'src/api/users', 'src/api/orders', 'src/api/auth', 'src/api/search', 'src/services/billing',
  'src/services/invoice', 'src/services/email', 'src/services/payments', 'src/lib/date', 'src/lib/money',
  'src/lib/retry', 'src/lib/validate', 'src/db/migrations', 'src/db/pool', 'src/jobs/reports',
  'src/jobs/cleanup', 'src/middleware/cors', 'src/middleware/rate-limit', 'src/utils/slugify',
  'src/utils/parse-csv', 'src/cache/store', 'src/webhooks/dispatch', 'src/config/env', 'src/queue/consumer',
  'src/auth/session', 'src/auth/tokens',
];

const int = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const pad2 = (n) => String(n).padStart(2, '0');
const clock = (ms) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${clock(ms)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

// ---- build: testes em modo watch ----

function testLine(rng, file) {
  const tests = int(rng, 2, 24);
  const ms = int(rng, 4, 420);
  if (rng() < 0.06) return { tests, line: [['yellow', ' ↓ '], ['', `${file}.test.ts `], ['dim', `(${tests} tests | ${tests} skipped)`]] };
  return { tests, line: [['green', ' ✓ '], ['', `${file}.test.ts `], ['dim', `(${tests} tests) `], [ms > 300 ? 'yellow' : 'dim', `${ms}ms`]] };
}

function summary(d, now) {
  const { files, tests, started } = d.run;
  const secs = (now - started) / 1000;
  return [
    [],
    [['dim', ' Test Files  '], ['green bold', `${files} passed`], ['dim', ` (${files})`]],
    [['dim', '      Tests  '], ['green bold', `${tests} passed`], ['dim', ` (${tests})`]],
    [['dim', '   Start at  '], ['', clock(started)]],
    [['dim', '   Duration  '], ['', `${secs.toFixed(2)}s`], ['dim', ` (transform ${(secs * 0.07).toFixed(2)}s, setup 0ms, collect ${(secs * 0.3).toFixed(2)}s)`]],
    [],
    [['inverse green', ' PASS '], ['green', ' Waiting for file changes...']],
    [['dim', '       press h to show help, press q to quit']],
  ];
}

const build = {
  init(d, now, rng) {
    d.run = { files: 0, tests: 0, started: now - int(rng, 9000, 20000) };
    d.lines.push([], [['inverse cyan', ' RUN '], ['cyan', ' v2.1.8 '], ['dim', '~/work/billing-service']], []);
    for (const file of FILES) {
      const t = testLine(rng, file);
      d.run.files++;
      d.run.tests += t.tests;
      d.lines.push(t.line);
    }
    d.lines.push(...summary(d, now));
    d.pending = [];
    d.nextAt = now + int(rng, 15000, 45000);
  },
  next(d, now, rng) {
    if (!d.pending.length) { // estava esperando: alguém "salvou um arquivo"
      const changed = pick(rng, FILES);
      d.pending = [changed, ...Array.from({ length: int(rng, 1, 5) }, () => pick(rng, FILES))];
      d.run = { files: 0, tests: 0, started: now };
      return { lines: [[], [['inverse blue', ' RERUN '], ['', ` ${changed}.ts `], ['dim', 'x1']], []], delay: int(rng, 300, 900) };
    }
    const t = testLine(rng, d.pending.shift());
    d.run.files++;
    d.run.tests += t.tests;
    if (d.pending.length) return { lines: [t.line], delay: int(rng, 150, 900) };
    return { lines: [t.line, ...summary(d, now)], delay: int(rng, 15000, 45000) };
  },
};

// ---- logs: tail -f de um servidor ----

const LOGS = [
  [8, 'INFO', 'http', (r) => `GET /api/orders/${int(r, 1000, 9999)} 200 ${int(r, 6, 90)}ms`],
  [6, 'INFO', 'http', (r) => `GET /api/users/${int(r, 100, 999)}/invoices 200 ${int(r, 12, 140)}ms`],
  [4, 'INFO', 'http', (r) => `POST /api/auth/refresh 204 ${int(r, 3, 30)}ms`],
  [3, 'INFO', 'http', () => 'GET /health 200 1ms'],
  [2, 'INFO', 'http', (r) => `POST /api/payments 201 ${int(r, 120, 480)}ms`],
  [2, 'DEBUG', 'db', (r) => `pool active=${int(r, 1, 6)} idle=${int(r, 2, 10)} waiting=0`],
  [2, 'INFO', 'cache', (r) => `hit ratio ${(0.88 + r() * 0.1).toFixed(2)} (last 60s)`],
  [2, 'INFO', 'jobs', (r) => `report.generate #${int(r, 4000, 9999)} done in ${(0.8 + r() * 3).toFixed(1)}s`],
  [1, 'INFO', 'queue', (r) => `consumed ${int(r, 1, 40)} messages from invoices.created`],
  [1, 'WARN', 'db', (r) => `slow query (${int(r, 600, 1500)}ms): SELECT * FROM invoices WHERE customer_id = $1`],
  [1, 'WARN', 'http', () => 'POST /api/search 429 rate limited (ip 10.0.3.17)'],
];
const LOG_WEIGHT = LOGS.reduce((sum, l) => sum + l[0], 0);
const LEVEL = { INFO: 'green', DEBUG: 'dim', WARN: 'yellow' };

function logLine(rng, ms) {
  let r = rng() * LOG_WEIGHT;
  const [, level, scope, msg] = LOGS.find((l) => (r -= l[0]) < 0) ?? LOGS[0];
  return [['dim', stamp(ms) + ' '], [LEVEL[level], level.padEnd(6)], ['cyan', `[${scope}] `], ['', msg(rng)]];
}

const logs = {
  init(d, now, rng) {
    // A tela já abre cheia, como um tail -f que estava rodando havia tempo.
    let t = now - 60000;
    while (t < now) { d.lines.push(logLine(rng, t)); t += int(rng, 150, 1500); }
    d.nextAt = now + int(rng, 200, 1500);
  },
  next(d, now, rng) {
    return { lines: [logLine(rng, now)], delay: int(rng, 150, 1800) };
  },
};

// ---- shell: prompt vazio ----

const shell = {
  init(d, now) { d.nextAt = Infinity; },
  next() { return { lines: [], delay: Infinity }; },
};

const prompt = (d) => [['green bold', `${d.user}@${d.host}`], ['', ':'], ['blue bold', '~'], ['', '$ ']];

const KINDS = { build, logs, shell };

// `who`: { user, host } de verdade deixam o prompt crível (o index.js lê do sistema).
export function createDisguise(kind, { now, rng = Math.random, user = 'dev', host = 'localhost' } = {}) {
  const d = { kind: KINDS[kind] ? kind : DISGUISES[0], lines: [], buffer: '', user, host, rng, nextAt: Infinity };
  KINDS[d.kind].init(d, now, rng);
  trim(d);
  return d;
}

function push(d, ...lines) {
  d.lines.push(...lines);
  trim(d);
}
const trim = (d) => { if (d.lines.length > MAX_LINES) d.lines.splice(0, d.lines.length - MAX_LINES); };

export function stepDisguise(d, now) {
  // Depois de um sono longo (notebook suspenso), não despeja minutos de linhas de uma vez.
  if (now - d.nextAt > 10000) d.nextAt = now;
  while (now >= d.nextAt) {
    const { lines, delay } = KINDS[d.kind].next(d, now, d.rng);
    push(d, ...lines);
    d.nextAt += delay;
  }
}

// Teclas que não são a de voltar. No shell vira digitação; nos logs, Enter pula uma linha
// (é o que se faz num tail -f para marcar um ponto). O resto é ignorado em silêncio.
export function disguiseKey(d, k) {
  if (d.kind !== 'shell') {
    if (k === 'enter') push(d, []);
    return;
  }
  if (k === 'enter') {
    const cmd = d.buffer.trim();
    d.buffer = '';
    if (cmd === 'clear') { d.lines = []; return; }
    push(d, [...prompt(d), ['', cmd]]);
    if (cmd) push(d, [['', `${cmd.split(/\s+/)[0]}: command not found`]]);
  } else if (k === 'backspace') {
    d.buffer = [...d.buffer].slice(0, -1).join('');
  } else if (k === 'ctrl-u') {
    d.buffer = '';
  } else if (k === 'space') {
    d.buffer += ' ';
  } else if ([...k].length === 1 && k >= ' ') {
    d.buffer += k;
  }
}

// Corta pelo texto visível antes de pintar, para o estilo nunca quebrar no meio.
function draw(segments, cols) {
  let room = cols;
  let out = '';
  for (const [st, text] of segments) {
    if (room <= 0) break;
    const part = [...text].slice(0, room).join('');
    room -= [...part].length;
    out += st ? paint(style(st), part) : part;
  }
  return out;
}

export function renderDisguise(d, cols, rows, now) {
  let lines = d.lines;
  if (d.kind === 'shell') {
    const cursor = Math.floor(now / BLINK_MS) % 2 === 0 ? '█' : ' ';
    lines = [...lines, [...prompt(d), ['', d.buffer + cursor]]];
  }
  const shown = lines.slice(-rows).map((segs) => draw(segs, cols));
  return [...shown, ...Array(Math.max(0, rows - shown.length)).fill('')];
}
