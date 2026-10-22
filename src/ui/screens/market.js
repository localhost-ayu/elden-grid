// Aba Mercado: preço da energia (demanda, surtos e o impacto das vendas), baterias e
// contratos de fornecimento (1.5). As peças entram uma por etapa.
import { MARKET } from '../../data/market.js';
import { price, priceBase, priceRising } from '../../core/engine.js';
import { surging } from '../../core/market.js';
import { C, paint, glyphs } from '../theme.js';
import { sparkline, fmtPct } from '../format.js';

export const help = () => 'Tab abas  espaço gira  M menu  Q sair';

const CHART_W = 60;

function priceBlock(s, history) {
  const p = price(s);
  const m = s.market;
  const trend = priceRising(s) ? `${glyphs().up} subindo` : `${glyphs().down} caindo`;
  const demand = surging(s)
    ? paint(C.yellow + C.bold, `SURTO x${MARKET.surge.mult} por mais ${Math.ceil(m.surgeUntil - s.t)} s`)
    : paint(m.demand >= 1 ? C.green : C.yellow, `demanda ${fmtPct(m.demand)}`) + paint(C.dim, m.target > m.demand + 0.01 ? ' (subindo)' : m.target < m.demand - 0.01 ? ' (caindo)' : '');
  const impact = m.impact > 0.005
    ? paint(C.red, `vendas recentes: preço -${Math.round((1 - 1 / (1 + m.impact)) * 100)}%`) + paint(C.dim, ' (passa sozinho)')
    : paint(C.dim, 'sem impacto de vendas');
  const series = history?.price ?? [];
  return [
    '   ' + `Preço agora ${paint(p >= priceBase(s) ? C.green : C.yellow, `$${p.toFixed(2)}/kWh`)}` +
      paint(C.dim, `  ·  média $${priceBase(s).toFixed(2)}  ·  ${trend}`),
    '   ' + demand + paint(C.dim, '  ·  ') + impact,
    '   ' + paint(C.cyan, sparkline(series, CHART_W)) + paint(C.dim, '  60 s'),
  ];
}

export function render(ctx) {
  const s = ctx.state;
  return [
    '   ' + paint(C.bold, 'Mercado de energia'),
    '',
    ...priceBlock(s, ctx.history),
  ];
}

export const key = () => false;
