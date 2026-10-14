// O brilho só corre pelos painéis de dia, e fica mais forte com o sol alto.
const PANEL = ' /_/_/_/_/ ';

export const fps = 3;
export function draw(f, { sun = 0 } = {}) {
  const sky = sun > 0.6 ? '    \\o/    ' : sun > 0 ? '     o     ' : '  .  )  .  ';
  let panel = PANEL;
  if (sun > 0) {
    const i = 2 + 2 * (f % 4);
    panel = PANEL.slice(0, i) + (sun > 0.6 ? '*' : '+') + PANEL.slice(i + 1);
  }
  return [sky, '  _______  ', panel, '/_/_/_/_/  ', '   |   |   '];
}
