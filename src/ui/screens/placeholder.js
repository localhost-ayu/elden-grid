import { C, paint } from '../theme.js';

export function placeholder(title, bullets) {
  return {
    help: 'Tab abas  espaço manivela  M menu  Q sair',
    render: () => [
      '',
      '   ' + paint(C.bold, title) + paint(C.dim, '  — em construção'),
      '',
      ...bullets.map((b) => paint(C.dim, '   · ' + b)),
    ],
    key: () => false,
  };
}
