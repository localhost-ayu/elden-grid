// Aba Mercado: preço da energia, baterias e contratos de fornecimento (1.5). Por
// enquanto mostra o preço e a tendência; as peças entram uma por etapa.
import { price, priceBase, priceRising } from '../../core/engine.js';
import { C, paint, glyphs } from '../theme.js';

export const help = () => 'Tab abas  espaço gira  M menu  Q sair';

export function render(ctx) {
  const s = ctx.state;
  const p = price(s);
  const trend = priceRising(s) ? `${glyphs().up} subindo` : `${glyphs().down} caindo`;
  return [
    '   ' + paint(C.bold, 'Mercado de energia'),
    '',
    '   ' + `Preço agora ${paint(p >= priceBase(s) ? C.green : C.yellow, `$${p.toFixed(2)}/kWh`)}` +
      paint(C.dim, `  ·  média $${priceBase(s).toFixed(2)}  ·  ${trend}`),
  ];
}

export const key = () => false;
