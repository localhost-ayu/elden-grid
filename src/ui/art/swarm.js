// Enxame: espelhos em órbita girando em volta do sol. Na janela de lançamento, um
// foguete sobe pela borda.
const RING = [
  [' .   o   . ', '   o   .   '],
  ['   .   o   ', ' o   .   . '],
];

export const fps = 3;
export function draw(f, { launch = false } = {}) {
  const [top, bottom] = RING[f % 2];
  const rocket = launch ? ['^', '|', '.'][f % 3] : ' ';
  return [top, ` o \\ | / ${rocket} `, '  -( O )-  ', ` . / | \\ o `, bottom];
}
