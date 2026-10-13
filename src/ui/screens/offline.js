import { C, paint } from '../theme.js';
import { fmt, fmtDuration } from '../format.js';
import { OFFLINE_RATE } from '../../core/engine.js';

export const help = 'qualquer tecla continua';

export function render(ctx) {
  const o = ctx.offline;
  const capped = o.counted < o.away;
  const pct = Math.round(OFFLINE_RATE * 100);
  return [
    '',
    '   ' + paint(C.bold, 'Enquanto você estava fora...'),
    '',
    `   Você ficou ${paint(C.bold, fmtDuration(o.away))} fora.` +
      paint(C.dim, capped ? ` Contaram ${fmtDuration(o.counted)} (o limite) a ${pct}% da produção.` : ` Produção a ${pct}%.`),
    '',
    '     ' + paint(C.green, `+$${fmt(o.money)}`),
    '     ' + paint(C.cyan, `+${fmt(o.energy)} kWh`),
    '     ' + paint(C.mag, `+${fmt(o.rp)} PP`),
    '',
    paint(C.dim, '   Pressione qualquer tecla para continuar.'),
  ];
}

export function key(ctx) {
  ctx.go('game');
  return true;
}
