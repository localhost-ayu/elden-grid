const STEAM = ['(', ')', "'"];
const at = (col, ch) => (' '.repeat(col) + ch).padEnd(11);

export const fps = 3;
export function draw(f) {
  return [at(5 + (f % 2), STEAM[(f + 2) % 3]), at(5, STEAM[f % 3]), '    /^\\    ', '  _/   \\_  ', '=====H====='];
}
