// Tela de título: letras no estilo figlet "small" dentro de um anel atravessado por uma
// linha vertical, como o anel dourado do logo que a paródia homenageia.
const E = [' ___ ', '| __|', '| _| ', '|___|'];
const L = [' _    ', '| |   ', '| |__ ', '|____|'];
const D = [' ___  ', '|   \\ ', '| |) |', '|___/ '];
const N = [' _  _ ', '| \\| |', '| .` |', '|_|\\_|'];
const G = ['  ___ ', ' / __|', '| (_ |', ' \\___|'];
const R = [' ___ ', '| _ \\', '|   /', '|_|_\\'];
const I = [' ___ ', '|_ _|', ' | | ', '|___|'];
const SPACE = ['   ', '   ', '   ', '   '];

const join = (letters) => letters.reduce((rows, l) => rows.map((r, i) => r + l[i]), ['', '', '', '']);
export const LOGO = join([E, L, D, E, N, SPACE, G, R, I, D]);

export const ART_W = 78;
const LOGO_X = 12; // letras centradas no anel
const LOGO_Y = 2;
const LINE_X = 41; // vão entre ELDEN e GRID

// Desenhado à mão, segmento a segmento ([coluna, texto] por linha): elipse calculada em
// caracteres sai serrilhada.
const RING = [
  [[25, "__..--''''''''''''''''--..__"]],
  [[12, "__..--''''''"], [53, "''''''--..__"]],
  [[6, "_.-''"], [67, "''-._"]],
  [[4, '/'], [73, '\\']],
  [[4, '\\'], [73, '/']],
  [[6, "'-._"], [68, "_.-'"]],
  [[12, "''--..__"], [57, "__..--''"]],
  [[20, "''''--.._____________________..--''''"]],
];

// Linhas do título como células { ch, ring }, para quem desenha pintar letras e anel com
// cores diferentes. As letras ficam na frente; a linha vertical só ocupa células vazias.
export function titleArt() {
  const rows = RING.map(() => Array.from({ length: ART_W }, () => ({ ch: ' ', ring: false })));
  RING.forEach((segments, y) => {
    for (const [x, text] of segments) [...text].forEach((ch, i) => { rows[y][x + i] = { ch, ring: true }; });
  });
  LOGO.forEach((line, i) => {
    [...line].forEach((ch, x) => { if (ch !== ' ') rows[LOGO_Y + i][LOGO_X + x] = { ch, ring: false }; });
  });
  for (const row of rows) if (row[LINE_X].ch === ' ') row[LINE_X] = { ch: '|', ring: true };
  return rows;
}

// Células do anel em volta do centro, em ordem de ângulo: o brilho percorre essa ordem.
// O fator 4 compensa a célula do terminal ser mais alta que larga.
export function ringOrder(rows) {
  const cells = [];
  rows.forEach((row, y) => row.forEach((c, x) => { if (c.ring && x !== LINE_X) cells.push({ x, y }); }));
  const cx = ART_W / 2;
  const cy = (rows.length - 1) / 2;
  const angle = (c) => Math.atan2((c.y - cy) * 4, c.x - cx);
  return cells.sort((a, b) => angle(a) - angle(b));
}

// Paródia da abertura do jogo homenageado, e a frase que acompanha o projeto desde o início.
export const TAGLINE = 'Erga-se, Maculado. As Terras Intermédias estão sem luz.';
export const MOTTO = 'energia limpa, lucro sujo';
