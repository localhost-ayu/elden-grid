// Coletor de quasar: o disco brilhante e os jatos para cima e para baixo.
const JET = ['|', '!', ':'];

export const fps = 4;
export function draw(f) {
  const j = JET[f % 3];
  return [`     ${j}     `, `   \\ ${j} /   `, ' ==(@@@)== ', `   / ${j} \\   `, `     ${j}     `];
}
