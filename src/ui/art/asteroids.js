// Mineração de asteroides: rochas passando e o rebocador; a carga pisca quando chega.
const ROCKS = ['o   .  O  ', '  O   o  .', '.  o  .  O'];

export const fps = 3;
export function draw(f, { arriving = false } = {}) {
  const ship = arriving ? '[==>##]' : '[==>  ]';
  return [` ${ROCKS[f % 3]}`, '           ', `  ${ship}  `, ' ' + ROCKS[(f + 1) % 3], '           '];
}
