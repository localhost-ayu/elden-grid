// Energia escura: o espaço se expandindo, pontos se afastando do centro.
const RINGS = [
  ['    . .    ', '   . o .   ', '    . .    '],
  ['   .   .   ', '  .  o  .  ', '   .   .   '],
  ['  .     .  ', ' .   o   . ', '  .     .  '],
];

export const fps = 3;
export function draw(f) {
  const r = RINGS[f % 3];
  return ['           ', r[0], r[1], r[2], '           '];
}
