import { glyphs } from './theme.js';

const SUFFIX = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi'];

// Depois de Qi (1e18) os sufixos ficam obscuros: a partir de 1e21 usa notação
// científica (1.23e24), que cabe na mesma largura e continua comparável.
const SCI_FROM = 1e21;

export function fmt(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 ? n.toFixed(2) : n.toFixed(1);
  if (n >= SCI_FROM) return n.toExponential(2).replace('e+', 'e');
  const i = Math.min(Math.floor(Math.log10(n) / 3), SUFFIX.length - 1);
  return (n / 1000 ** i).toFixed(2) + SUFFIX[i];
}

// Códigos ANSI (cor, cursor) ocupam bytes mas zero colunas; precisam sair da conta.
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
export const stripAnsi = (s) => s.replace(ANSI_RE, '');

// Faixas de caracteres "largos" (ocupam 2 colunas no terminal): CJK e emoji com
// apresentação de emoji por padrão (ex.: ⚡). Não é um wcwidth completo, só o que um
// jogo em pt-BR com alguns símbolos realmente usa; contar errado desalinharia a moldura.
const WIDE = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693],
  [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce],
  [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0],
  [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x303e],
  [0x3041, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60],
  [0xffe0, 0xffe6], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
];
// Marcas combinantes e seletores de variação "grudam" no caractere anterior (0 colunas).
const ZERO = [[0x0300, 0x036f], [0x200b, 0x200f], [0xfe00, 0xfe0f]];
const inRanges = (cp, ranges) => ranges.some(([a, b]) => cp >= a && cp <= b);

export function charWidth(cp) {
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (inRanges(cp, ZERO)) return 0;
  return inRanges(cp, WIDE) ? 2 : 1;
}

export function visibleLength(s) {
  let w = 0;
  for (const ch of stripAnsi(s)) w += charWidth(ch.codePointAt(0));
  return w;
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

export const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function bar(fraction, width) {
  const g = glyphs();
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const full = Math.round(f * width);
  return g.barFull.repeat(full) + g.barEmpty.repeat(width - full);
}

// Altura relativa a [mín, máx] da série; série constante vira uma linha no meio.
export function sparkline(values, width = values.length) {
  const chars = glyphs().spark;
  const vals = values.slice(-width);
  if (!vals.length) return ' '.repeat(width);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const top = chars.length - 1;
  const line = vals.map((v) => chars[span > 0 ? Math.round(((v - min) / span) * top) : Math.floor(top / 2)]).join('');
  return ' '.repeat(width - vals.length) + line;
}

export const padVisible = (str, width) => str + ' '.repeat(Math.max(0, width - visibleLength(str)));

// Porcentagem para exibição; acima de 999% vira ">999%" (rede muito saturada não
// pode empurrar o layout com um número de 7 dígitos).
export const fmtPct = (f) => (f > 9.99 ? '>999%' : `${Math.round(f * 100)}%`);
