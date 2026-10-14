// A fumaça de um quadro aparece uma linha acima no seguinte: parece subir.
const PUFF = ['o', 'O', '.'];
const at = (col, ch) => (' '.repeat(col) + ch).padEnd(11);

export const fps = 3;
export function draw(f) {
  return [at(2 + (f % 2), PUFF[(f + 2) % 3]), at(3, PUFF[f % 3]), '   ||      ', ' _||______ ', '|{&}|_|{&}|'];
}
