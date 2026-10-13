// Melhor um aviso do que um layout cortado/embaralhado.
import { C, paint } from '../theme.js';

export const MIN_COLS = 80;
export const MIN_ROWS = 24;

export const tooSmall = (cols, rows) => cols < MIN_COLS || rows < MIN_ROWS;

export function renderTooSmall(cols, rows) {
  const msg = [
    'Terminal pequeno demais',
    `atual ${cols}×${rows} · mínimo ${MIN_COLS}×${MIN_ROWS}`,
    'aumente a janela (q sai)',
  ];
  const top = Math.max(0, Math.floor((rows - msg.length) / 2));
  const lines = Array(top).fill('');
  for (const [i, m] of msg.entries()) {
    const pad = ' '.repeat(Math.max(0, Math.floor((cols - m.length) / 2)));
    lines.push(pad + paint(i === 0 ? C.yellow : C.dim, m));
  }
  return lines;
}
