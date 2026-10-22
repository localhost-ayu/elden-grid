// Star Lifting: um funil magnético puxando plasma da coroa do Sol.
const PLASMA = ['  ~ ~ ~  ', ' ~ ~ ~ ~ ', '~ ~ ~ ~ ~'];

export const fps = 4;
export function draw(f) {
  return ['  \\  |  /  ', '   \\ | /   ', `  ${PLASMA[f % 3]}`, ' (( SOL )) ', '  ~~~~~~~  '];
}
