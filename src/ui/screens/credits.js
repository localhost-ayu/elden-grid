// Créditos (menu): quem fez, de onde veio a ideia e um obrigado a quem jogou.
import { C, paint, glyphs } from '../theme.js';
import { visibleLength } from '../format.js';

export const help = 'Esc volta  Q sair';

const center = (text, cols) => ' '.repeat(Math.max(0, Math.floor((cols - visibleLength(text)) / 2))) + text;

export function render(ctx, height = 20, width = 80) {
  const star = glyphs().legacy;
  const lines = [
    paint(C.bold + C.yellow, `${star}  E L D E N   G R I D  ${star}`),
    paint(C.dim, `um idle game de energia no terminal${ctx.version ? ` · versão ${ctx.version}` : ''}`),
    '',
    paint(C.bold, 'Criado por'),
    'Nathã Grazzioli · localhost-ayu',
    '',
    paint(C.bold, 'Inspirado em'),
    'Reactor – Energy Sector Tycoon · Adventure Capitalist',
    'a escala de Kardashev (Nikolai Kardashev, 1964), na fórmula de Carl Sagan',
    '',
    paint(C.dim, 'Node.js puro, sem dependências · licença PolyForm Noncommercial 1.0.0'),
    '',
    paint(C.bold + C.green, 'Obrigado por jogar!'),
    paint(C.green, 'Do primeiro giro da manivela ao núcleo da galáxia: obrigado por cada watt.'),
  ];
  const pad = Math.max(0, Math.floor((height - lines.length) / 2));
  return [...Array(pad).fill(''), ...lines.map((l) => center(l, width))];
}

export const key = () => false;
