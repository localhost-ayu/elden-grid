// Aba Mercado: preço da energia (demanda, surtos e o impacto das vendas), baterias e
// contratos de fornecimento (1.5). As peças entram uma por etapa.
import { MARKET, BATTERY, REPUTATION } from '../../data/market.js';
import { price, priceBase, priceRising, capacity, batteryValue, sellBattery } from '../../core/engine.js';
import { surging, batteryCap, bankCost, canBuyBank, repTier, repName, nextTier } from '../../core/market.js';
import { buyBank } from '../../core/actions.js';
import { CONTRACTS } from '../../data/contracts.js';
import { accept, abandon, progress, greenShare } from '../../core/contracts.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt, fmtClock, bar, sparkline, fmtPct } from '../format.js';

export const help = (ctx) => (ctx.state.market.contracts.active
  ? 'V vende bateria  A auto  C carga barata  B +banco  D desiste  Tab abas  Q sair'
  : 'V vende bateria  A auto  C carga barata  B +banco  1-3 aceita  Tab abas  Q sair');

// Texto de um contrato ("Entrega: 1.2M kWh em 2:30") e da recompensa ("$45k" / "120 PP").
export function contractTitle(c) {
  const time = fmtClock(c.duration);
  const name = CONTRACTS[c.type].name;
  if (c.type === 'delivery') return `${name}: ${fmt(c.target)} kWh em ${time}`;
  if (c.type === 'sales') return `${name}: faturar $${fmt(c.target)} em ${time}`;
  if (c.type === 'green') return `${name}: ${Math.round(c.target * 100)}% renovável por ${time}`;
  return `${name}: nenhum reator desliga por ${time}`;
}
export const rewardTitle = (r) => (r.rp ? `${fmt(r.rp)} PP` : `$${fmt(r.money)}`);

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
    '   ' + paint(C.bold, 'Mercado') + `  preço ${paint(p >= priceBase(s) ? C.green : C.yellow, `$${p.toFixed(2)}/kWh`)}` +
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
    ];
  }
  const worth = batteryValue(s, b.kwh, BATTERY.manualRate);
  return [
    '   ' + paint(C.bold, 'Baterias') + paint(C.dim, ` ${b.banks}x  `) + paint(C.cyan, bar(cap ? b.kwh / cap : 0, 16)) +
      paint(C.dim, ` ${fmt(b.kwh)}/${fmt(cap)} kWh  ·  `) + buy,
    '   ' + paint(b.kwh > 0 ? C.green : C.dim, `[V] vender ~$${fmt(worth)}`) +
      paint(C.dim, '  ·  [A] auto ') + onOff(b.auto) + paint(C.dim, '  ·  [C] carga barata ') + onOff(b.cheap),
  ];
}

function contractBlock(s) {
  const c = s.market.contracts;
  const tier = repTier(s);
  const next = nextTier(s);
  const rep = paint(C.cyan, `reputação ${repName(s)}`) +
    paint(C.dim, `${tier ? ` (+${Math.round(REPUTATION.rewardPerTier * tier * 100)}% contratos, +${Math.round(REPUTATION.pricePerTier * tier * 100)}% kWh)` : ''}` +
      (next ? ` · ${Math.floor(s.market.rep)}/${next.at}` : ''));
  const head = '   ' + paint(C.bold, 'Contratos') + paint(C.dim, `  ${c.done} cumpridos · `) + rep;
  const lines = [head];
  const a = c.active;
  if (a) {
    const left = Math.max(0, a.deadline - s.t);
    const extra = a.type === 'green' ? `  agora ${Math.round(greenShare(s) * 100)}%` : '';
    lines.push('   ' + paint(C.yellow + C.bold, 'ATIVO ') + contractTitle(a));
    lines.push('   ' + paint(C.green, bar(progress(s), 20)) + paint(C.dim, `  ${fmtClock(left)} restantes${extra}  →  `) +
      paint(C.green, rewardTitle(a.reward)) + paint(C.dim, '  [D] desiste'));
  }
  if (!c.offers.length && !a) lines.push(paint(C.dim, '   Nenhuma oferta agora: elas chegam com o tempo.'));
  c.offers.forEach((o, i) => {
    const text = `[${i + 1}] ${contractTitle(o)}  →  ${rewardTitle(o.reward)}`;
    lines.push('   ' + paint(a ? C.dim : '', text) + paint(C.dim, `  (some em ${fmtClock(Math.max(0, o.expires - s.t))})`));
  });
  return lines;
}

export function render(ctx) {
  const s = ctx.state;
  return [
    ...priceBlock(s, ctx.history),
    '',
    ...batteryBlock(s),
    '',
    ...contractBlock(s),
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
  if (k === 'd' || k === 'D') {
    if (abandon(s)) ctx.say('Contrato abandonado. Sem multa.', 'info');
    else ctx.say('Nenhum contrato ativo.', 'info');
    return true;
  }
  if (['1', '2', '3'].includes(k)) {
    const o = s.market.contracts.offers[+k - 1];
    if (s.market.contracts.active) ctx.say('Já há um contrato ativo: cumpra ou desista (D) antes.', 'err');
    else if (!o) ctx.say('Não há oferta nesse número.', 'info');
    else if (accept(s, +k - 1)) ctx.say(`Contrato aceito: ${contractTitle(o)}.`, 'ok');
    return true;
  }
  if (k === 'a' || k === 'A') { b.auto = !b.auto; ctx.say(`Venda automática ${b.auto ? 'ligada' : 'desligada'}.`, 'info', 2000); return true; }
  if (k === 'c' || k === 'C') { b.cheap = !b.cheap; ctx.say(`Carga barata ${b.cheap ? 'ligada' : 'desligada'}.`, 'info', 2000); return true; }
  return false;
}
