// Motor de Penrose: buraco negro girando, com a ergosfera em volta.
const SPIN = ['/', '-', '\\', '|'];

export const fps = 4;
export function draw(f) {
  const a = SPIN[f % 4];
  const b = SPIN[(f + 2) % 4];
  return ['  .-----.  ', ` /  ${a} ${b}  \\ `, '|  ( @ )  |', ` \\  ${b} ${a}  / `, "  '-----'  "];
}
