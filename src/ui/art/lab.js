const BUBBLES = ['     o     ', '    .  o   ', '   o   .   '];

export const fps = 3;
export function draw(f) {
  return [BUBBLES[f % 3], '    | |    ', '    / \\    ', '   /~~~\\   ', '  /_____\\  '];
}
