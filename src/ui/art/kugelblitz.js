// Kugelblitz: buraco negro artificial com o disco de acreção girando. Mal alimentado,
// o disco afina.
const DISK = ['=-(  @  )-=', '-=(  @  )=-'];
const DUST = ['  .  *  .  ', '  *  .  *  '];

export const fps = 4;
export function draw(f, { fed = 1 } = {}) {
  const disk = fed < 0.5 ? ' -(  @  )- ' : DISK[f % 2];
  return [DUST[f % 2], '   .---.   ', disk, "   '---'   ", DUST[(f + 1) % 2]];
}
