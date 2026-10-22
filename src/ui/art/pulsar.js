// Fazenda de pulsares: a estrela de nêutrons e o feixe varrendo; no pulso, o feixe acende.
export const fps = 4;
export function draw(f, { arriving = false } = {}) {
  const beam = arriving ? '=====' : f % 2 ? '- - -' : ' - - ';
  return ['     |     ', `${beam} * ${beam}`.slice(0, 11), '    -+-    ', '     |     ', '  [=====]  '];
}
