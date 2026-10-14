// Mesma fumaça que sobe da biomassa, em duas chaminés defasadas.
const PUFF = ['o', 'O', '.'];
function smoke(a, b) {
  const row = [...' '.repeat(11)];
  row[3] = a;
  row[8] = b;
  return row.join('');
}

export const fps = 3;
export function draw(f) {
  return [
    smoke(PUFF[(f + 2) % 3], PUFF[(f + 1) % 3]),
    smoke(PUFF[f % 3], PUFF[(f + 2) % 3]),
    '  | |  | | ',
    ' _| |__| |_',
    '|__GAS____|',
  ];
}
