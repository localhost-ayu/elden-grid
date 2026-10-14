const CORE = ['( )', '(o)', '(O)', '(*)'];

export const fps = 3;
export function draw(f) {
  return ['  .-----.  ', ' / .---. \\ ', `| | ${CORE[f % 4]} | |`, " \\ '---' / ", "  '-----'  "];
}
