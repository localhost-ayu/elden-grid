// Dois quadros (x e +) alternando dão a ilusão de giro; a cena acelera com o vento.
const X = ['   \\   /   ', '     O     ', '   / | \\   ', '     |     ', '    /_\\    '];
const PLUS = ['     |     ', '   --O--   ', '     |     ', '     |     ', '    /_\\    '];

export const fps = 3;
export const draw = (f) => (f % 2 ? PLUS : X);
