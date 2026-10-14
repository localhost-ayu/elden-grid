// As ondas correm de lado e o rotor submerso gira; com maré alta a água sobe uma linha.
const WAVE = '~^~_';
const waves = (f) => Array.from({ length: 11 }, (_, i) => WAVE[(i + f) % 4]).join('');

export const fps = 3;
export function draw(f, { high = true } = {}) {
  return [
    high ? waves(f) : ' '.repeat(11),
    high ? '~~~~~~~~~~~' : waves(f),
    `  |=${f % 2 ? '(x)' : '(+)'}=|  `,
    '  |     |  ',
    '##|#####|##',
  ];
}
