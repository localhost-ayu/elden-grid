// Energia do vácuo: espuma quântica que ferve mais forte quanto maior a flutuação.
const FOAM = ['.:*:.:*:.', ':*:.:*:.:', '*:.:*:.:*'];

export const fps = 5;
export function draw(f, { surge = 1 } = {}) {
  const foam = surge >= 2 ? FOAM[f % 3].replace(/[.:]/g, '*') : surge < 0.5 ? FOAM[f % 3].replace(/\*/g, '.') : FOAM[f % 3];
  return ['  ~  .  ~  ', ` ${foam} `, '<( ~~~~~ )>', ` ${FOAM[(f + 1) % 3]} `, '  .  ~  .  '];
}
