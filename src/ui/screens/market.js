// Aba Mercado: preço da energia (demanda, surtos e o impacto das vendas), baterias e
// contratos de fornecimento (1.5). As peças entram uma por etapa.
import { MARKET, BATTERY } from '../../data/market.js';
import { price, priceBase, priceRising, capacity, batteryValue, sellBattery } from '../../core/engine.js';
import { surging, batteryCap, bankCost, canBuyBank } from '../../core/market.js';
import { buyBank } from '../../core/actions.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt, bar, sparkline, fmtPct } from '../format.js';

export const help = () => 'V vende a bateria  A venda auto  C carga barata  B +banco  Tab abas  Q sair';

const CHART_W = 60;
const onOff = (on) => (on ? paint(C.green, 'ligada') : paint(C.dim, 'desligada'));

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

function batteryBlock(s) {
  const b = s.market.battery;
  const cap = batteryCap(s, capacity(s));
  const buy = canBuyBank(s)
    ? paint(s.money >= bankCost(s) ? C.yellow : C.dim, `[B] +1 banco $${fmt(bankCost(s))}`)
    : paint(C.dim, 'bancos no máximo');
  if (!b.banks) {
    return [
      '   ' + paint(C.bold, 'Baterias') + paint(C.dim, '  nenhum banco ainda  ·  ') + buy,
      paint(C.dim, `   Cada banco guarda ${BATTERY.bankSeconds} s da capacidade da rede e carrega com o excedente.`),
      paint(C.dim, '   Venda na hora boa (surto, preço alto); muito de uma vez derruba o preço.'),
    ];
  }
  const worth = batteryValue(s, b.kwh, BATTERY.manualRate);
  return [
    '   ' + paint(C.bold, 'Baterias') + paint(C.dim, `  ${b.banks} ${b.banks === 1 ? 'banco' : 'bancos'}  ·  `) + buy,
    '   ' + paint(C.cyan, bar(cap ? b.kwh / cap : 0, 30)) + paint(C.dim, `  ${fmt(b.kwh)} / ${fmt(cap)} kWh`),
    '   ' + paint(b.kwh > 0 ? C.green : C.dim, `[V] vender agora: ~$${fmt(worth)}`),
    '   ' + paint(C.dim, '[A] venda automática ') + onOff(b.auto) +
      paint(C.dim, `  (surto ou >${Math.round(BATTERY.autoAbove * 100)}% da média, a ${Math.round(BATTERY.autoRate * 100)}% do valor)`),
    '   ' + paint(C.dim, '[C] carga barata ') + onOff(b.cheap) +
      paint(C.dim, `  (guarda ${Math.round(BATTERY.cheapShare * 100)}% da produção com o preço abaixo da média)`),
  ];
}

export function render(ctx) {
  const s = ctx.state;
  return [
    '   ' + paint(C.bold, 'Mercado de energia'),
    '',
    ...priceBlock(s, ctx.history),
    '',
    ...batteryBlock(s),
  ];
}

export function key(ctx, k) {
  const s = ctx.state;
  const b = s.market.battery;
  if (k === 'b' || k === 'B') {
    const c = bankCost(s);
    if (!canBuyBank(s)) ctx.say('Bancos de bateria no máximo.', 'info');
    else if (buyBank(s)) ctx.say(`Banco de baterias ${b.banks} instalado!`, 'ok');
    else ctx.say(`Faltam $${fmt(c - s.money)} para o próximo banco.`, 'err');
    return true;
  }
  if (!b.banks && 'vVaAcC'.includes(k)) { ctx.say('Compre um banco de baterias primeiro (B).', 'err'); return true; }
  if (k === 'v' || k === 'V') {
    if (b.kwh <= 0) { ctx.say('A bateria está vazia.', 'info'); return true; }
    const kwh = b.kwh;
    const money = sellBattery(s);
    ctx.say(`Vendeu ${fmt(kwh)} kWh por $${fmt(money)}.`, 'ok');
    return true;
  }
  if (k === 'a' || k === 'A') { b.auto = !b.auto; ctx.say(`Venda automática ${b.auto ? 'ligada' : 'desligada'}.`, 'info', 2000); return true; }
  if (k === 'c' || k === 'C') { b.cheap = !b.cheap; ctx.say(`Carga barata ${b.cheap ? 'ligada' : 'desligada'}.`, 'info', 2000); return true; }
  return false;
}
