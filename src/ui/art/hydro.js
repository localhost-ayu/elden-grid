// A água desce em diagonal pela barragem; com o reservatório alto, transborda no topo.
const DROP = "~',.";

export const fps = 4;
export function draw(f, { level = 0.5 } = {}) {
  const fall = (r) => ' '.repeat(r) + DROP[(((r - f) % 4) + 4) % 4] + ' '.repeat(4 - r);
  return [
    (level > 0.5 ? '~~~~~' : '     ') + '|     ',
    '~~~~~|' + fall(0),
    '~~~~~|' + fall(1),
    '~~~~~|' + fall(2),
    '=====|__~~~',
  ];
}
