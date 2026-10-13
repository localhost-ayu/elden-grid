// Janela em volta do item selecionado, com "↑ mais N" / "↓ mais N" nas pontas para o
// jogador saber que há mais.
import { C, paint } from './theme.js';

export function scrollWindow(lines, sel, height) {
  if (lines.length <= height) return lines;
  const h = Math.max(1, height - 2);
  const start = Math.max(0, Math.min(sel - Math.floor(h / 2), lines.length - h));
  const end = start + h;
  return [
    start > 0 ? paint(C.dim, `     ↑ mais ${start}`) : '',
    ...lines.slice(start, end),
    end < lines.length ? paint(C.dim, `     ↓ mais ${lines.length - end}`) : '',
  ];
}
