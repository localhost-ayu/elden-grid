const CORE = [' . ', '(o)', '(@)', '<@>'];
const SPARKS = ['   *   .   ', '   .   *   '];

export const fps = 4;
export function draw(f) {
  return [SPARKS[f % 2], '  <=====>  ', ` <| ${CORE[f % 4]} |> `, '  <=====>  ', SPARKS[(f + 1) % 2]];
}
