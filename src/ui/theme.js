// Único lugar com códigos de cor ANSI. `C` e `GEN_COLOR` são mutados por setColorMode,
// então são lidos na hora de pintar, nunca copiados para constantes de módulo.
const COLORS = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', mag: '\x1b[35m',
};
export const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  underline: '\x1b[4m', inverse: '\x1b[7m',
  ...COLORS,
};

export const paint = (color, text) => (color ? `${color}${text}${C.reset}` : text);

// Cor de cada fonte (mapa da rede, gráficos). Em 16 cores, fontes "irmãs" dividem cor
// (o mapa sempre traz legenda com o nome); com 256 cores, cada uma tem a sua.
const GEN_16 = {
  wind: C.cyan, solar: C.yellow, hydro: '\x1b[34m', biomass: C.green, gas: '\x1b[33m',
  geothermal: C.red, nuclear: C.mag, tidal: '\x1b[34m', fusion: '\x1b[95m', antimatter: '\x1b[91m',
  swarm: '\x1b[93m', kugelblitz: C.mag,
};
const c256 = (n) => `\x1b[38;5;${n}m`;
const GEN_256 = {
  wind: c256(81), solar: c256(220), hydro: c256(33), biomass: c256(70), gas: c256(208),
  geothermal: c256(167), nuclear: c256(141), tidal: c256(37), fusion: c256(213), antimatter: c256(196),
  swarm: c256(228), kugelblitz: c256(99),
};
export const GEN_COLOR = { ...GEN_256 };

// 'full' | '16' | 'none'. Sem cor, negrito/esmaecido/inverso continuam: são eles que
// marcam seleção e hierarquia, e NO_COLOR só pede para tirar as cores.
export function setColorMode(mode) {
  for (const [k, v] of Object.entries(COLORS)) C[k] = mode === 'none' ? '' : v;
  const gen = mode === 'full' ? GEN_256 : GEN_16;
  for (const k of Object.keys(GEN_COLOR)) GEN_COLOR[k] = mode === 'none' ? '' : gen[k];
}

// Nem todo terminal/fonte tem blocos e box drawing: os desenhos pedem glifos por nome
// para o conjunto poder ser trocado por ASCII puro.
const UNICODE = {
  shade: ['░', '▒', '▓', '█'],     // intensidade crescente
  spark: '▁▂▃▄▅▆▇█',              // 8 alturas para sparkline
  barFull: '█', barEmpty: '░',
  box: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', tee: '┤' },
  off: '×', empty: '·',
  up: '▲', down: '▼', legacy: '✦',
  warn: '⚠', cursor: '▼', dot: '●', dotEmpty: '○',
  arrow: { up: '↑', right: '→', down: '↓', left: '←' },
};
const ASCII = {
  shade: ['.', ':', '+', '#'],
  spark: '_.-:=+*#',
  barFull: '#', barEmpty: '.',
  box: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', tee: '+' },
  off: 'x', empty: '.',
  up: '^', down: 'v', legacy: '*',
  warn: '!', cursor: 'v', dot: 'o', dotEmpty: '.',
  arrow: { up: '^', right: '>', down: 'v', left: '<' },
};
let glyphSet = UNICODE;
export const glyphs = () => glyphSet;
export const setUnicode = (on) => { glyphSet = on ? UNICODE : ASCII; };

// Rede de segurança do modo ASCII, aplicada pelo screen.js a cada célula: qualquer
// símbolo escrito direto numa tela também vira ASCII, sem caçar tela por tela. Acentos
// ficam (são texto, não desenho). Tudo vira 1 coluna, como no Unicode (⚡ era 2).
const ASCII_MAP = {
  '─': '-', '│': '|', '┌': '+', '┐': '+', '└': '`', '┘': '+', '├': '|', '┤': '+',
  '░': '.', '▒': ':', '▓': '+', '█': '#', '▁': '_', '▂': '.', '▃': '-', '▄': ':', '▅': '=', '▆': '+', '▇': '*',
  '·': '.', '—': '-', '–': '-', '…': '.', '›': '>', '‹': '<', '▸': '>', '→': '>', '←': '<', '↑': '^', '↓': 'v',
  '▲': '^', '▼': 'v', '×': 'x', '✓': 'v', '•': '*', '●': 'o', '○': '.', '✦': '*', '★': '*', '⚡': '!', '⚠': '!',
  '⟳': '@', '☼': '*', '☾': 'C', '≈': '~', '÷': '/', '≠': '!', '±': '+',
};
export const toAscii = (ch) => ASCII_MAP[ch] ?? ch;
