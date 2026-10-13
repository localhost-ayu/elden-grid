// Único lugar com códigos de cor ANSI.
export const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  underline: '\x1b[4m', inverse: '\x1b[7m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', mag: '\x1b[35m',
};

export const paint = (color, text) => `${color}${text}${C.reset}`;

// Cor de cada fonte (mapa da rede, gráficos). Fontes "irmãs" dividem cor quando a
// paleta de 8 cores básicas acaba; o mapa sempre traz legenda com o nome.
export const GEN_COLOR = {
  wind: C.cyan, solar: C.yellow, hydro: '\x1b[34m', biomass: C.green, gas: '\x1b[33m',
  geothermal: C.red, nuclear: C.mag, tidal: '\x1b[34m', fusion: '\x1b[95m', antimatter: '\x1b[91m',
};

// Nem todo terminal/fonte tem blocos e box drawing: os desenhos pedem glifos por nome
// para o conjunto poder ser trocado por ASCII puro.
const UNICODE = {
  shade: ['░', '▒', '▓', '█'],     // intensidade crescente
  spark: '▁▂▃▄▅▆▇█',              // 8 alturas para sparkline
  barFull: '█', barEmpty: '░',
  box: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', tee: '┤' },
  off: '×', empty: '·',
};
const ASCII = {
  shade: ['.', ':', '+', '#'],
  spark: '_.-:=+*#',
  barFull: '#', barEmpty: '.',
  box: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', tee: '+' },
  off: 'x', empty: '.',
};
let glyphSet = UNICODE;
export const glyphs = () => glyphSet;
export const setUnicode = (on) => { glyphSet = on ? UNICODE : ASCII; };
