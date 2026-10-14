// O núcleo pulsa; quem anima acelera e muda a cor conforme o calor do reator.
const CORE = ['( )', '(o)', '(O)', '(*)'];

export const fps = 2;
export function draw(f) {
  return ['   _____   ', '  /     \\  ', ` |  ${CORE[f % 4]}  | `, ' |       | ', '_|_______|_'];
}
