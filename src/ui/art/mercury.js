// Coletor de Mercúrio: espelhos em leque virados para um Sol enorme.
const RAYS = ['\\ | /', '- * -'];

export const fps = 3;
export function draw(f) {
  return [`   ${RAYS[f % 2]}   `, '    (O)    ', ' \\ \\ / /   ', '  \\_|_/    ', ' ____|____ '];
}
