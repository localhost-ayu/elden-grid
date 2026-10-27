// Esferas de Dyson: a estrela coberta por cascas, com frestas de luz girando.
const SHELL = ['#.#.#', '.#.#.', '#.#.#'];

export const fps = 3;
export function draw(f) {
  return ['   .---.   ', `  /${SHELL[f % 3]}\\  `, ` |${SHELL[(f + 1) % 3]}*${SHELL[(f + 1) % 3].slice(0, 1)}| `.slice(0, 11), `  \\${SHELL[(f + 2) % 3]}/  `, "   '---'   "];
}
