// Hélio-3: escavadeira na superfície lunar; à noite (dia lunar), o céu fica estrelado.
const DUST = ['  .  . *   ', ' *  .   .  '];
const ARM = ['/', '-', '\\'];

export const fps = 3;
export function draw(f, { day = true } = {}) {
  const sky = day ? '    ( )    ' : DUST[f % 2];
  return [sky, `  __${ARM[f % 3]}__    `, ' |He3|==o  ', '_|___|____ ', '  ~  ~  ~  '];
}
