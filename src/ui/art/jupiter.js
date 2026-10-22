// Dínamo de Júpiter: o gigante com faixas e a corrente de Io.
const BANDS = ['~~~~~', '=====', '~~~~~'];

export const fps = 3;
export function draw(f) {
  const io = ['o      ', '   o   ', '      o'][f % 3];
  return ['   .---.   ', `  /${BANDS[f % 3]}\\  `, ` | ${BANDS[(f + 1) % 3]} | `, `  \\${BANDS[(f + 2) % 3]}/  `, `   ${io} `];
}
