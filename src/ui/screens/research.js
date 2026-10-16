// O primeiro pré-requisito de uma tech é o pai dela na árvore; pré-requisitos extras
// só aparecem como "requer".
import { GENERATORS } from '../../data/generators.js';
import { TECHS } from '../../data/research.js';
import { bought, capacity, excessRate, rpRate } from '../../core/engine.js';
import { buyTech } from '../../core/actions.js';
import { C, paint } from '../theme.js';
import { fmt, visibleLength } from '../format.js';
import { scrollWindow } from '../list.js';

export const help = '↑↓ escolher  Enter pesquisar  espaço manivela  Tab abas  M menu  Q sair';

const byId = new Map(TECHS.map((t) => [t.id, t]));
const techName = (id) => byId.get(id)?.name ?? id;
const missing = (s, t) => t.req.filter((r) => !bought(s, r));

export function describe(t) {
  switch (t.type) {
    case 'genMult': return `${GENERATORS.find((g) => g.id === t.gen).name} x${t.mult}`;
    case 'global': return `toda a produção x${t.mult}`;
    case 'price': return `preço do kWh x${t.mult}`;
    case 'lab': return `pesquisa x${t.mult}`;
    case 'unlock': return `destrava ${GENERATORS.find((g) => g.unlock === t.id)?.name ?? 'novo gerador'}`;
    case 'battery': return `solar à noite +${Math.round(t.add * 100)}% da capacidade`;
    case 'capacity': return `capacidade da rede x${t.mult}`;
    case 'launch': return `janela de lançamento +${t.add} s`;
    case 'feed': return `Kugelblitz precisa de ${Math.round((1 - t.mult) * 100)}% menos alimentação`;
    case 'vacuumFloor': return `vácuo nunca abaixo de x${t.floor}`;
    case 'excess': return `excedente da rede vale +${Math.round(t.add * 100)}% do preço`;
    case 'auto': return `auto-compra do gerador mais barato (${t.interval < 1 ? `${Math.round(1 / t.interval)}/s` : `1 a cada ${t.interval} s`})`;
    default: return '';
  }
}

// Cada nível usa só 2 colunas para a árvore funda (6 níveis) ainda deixar espaço para
// custo e efeito em 80 colunas.
export function flattenTree(techs = TECHS) {
  const children = new Map(techs.map((t) => [t.id, []]));
  const roots = [];
  for (const t of techs) {
    const parent = t.req[0];
    if (parent && children.has(parent)) children.get(parent).push(t);
    else roots.push(t);
  }
  const out = [];
  const walk = (list, prefix) => {
    list.forEach((t, i) => {
      const last = i === list.length - 1;
      out.push({ tech: t, prefix: prefix + (last ? '└─ ' : '├─ ') });
      walk(children.get(t.id), prefix + (last ? '  ' : '│ '));
    });
  };
  walk(roots, '');
  return out;
}
const TREE = flattenTree();

function status(s, t) {
  if (bought(s, t.id)) return 'done';
  return missing(s, t).length ? 'locked' : 'open';
}
const ICON = { done: '✓', open: '•', locked: '×' };

// O efeito é cortado com "…" para nunca passar da largura do terminal.
const NAME_COL = 42;
function row(s, node, selected, width) {
  const t = node.tech;
  const st = status(s, t);
  const left = `${selected ? '›' : ' '} ${node.prefix}${ICON[st]} ${t.name}`;
  const cost = (fmt(t.cost) + ' PP').padStart(9);
  let right = st === 'locked' ? 'requer: ' + missing(s, t).map(techName).join(', ') : describe(t);
  // Ramos fundos (a Fronteira fica 8 níveis abaixo da raiz) empurram a coluna do custo.
  const nameCol = Math.max(NAME_COL, visibleLength(left) + 1);
  const room = width - 2 - nameCol - cost.length - 2;
  if (visibleLength(right) > room) right = [...right].slice(0, Math.max(0, room - 1)).join('') + '…';
  const text = `${left.padEnd(nameCol)}${cost}  ${right}`;
  const style = st === 'done' ? C.dim + C.green
    : st === 'locked' ? C.dim
    : s.rp >= t.cost ? C.mag : '';
  return ' ' + paint(style + (selected ? C.bold : ''), text);
}

function detail(s, t) {
  let effect = describe(t);
  if (t.type === 'capacity') {
    effect += ` (${fmt(capacity(s))} → ${fmt(capacity(s) * (bought(s, t.id) ? 1 : t.mult))} kW)`;
  }
  const st = status(s, t);
  let state;
  if (st === 'done') state = paint(C.green, 'pesquisada ✓');
  else if (st === 'locked') state = paint(C.yellow, 'requer: ' + missing(s, t).map(techName).join(', '));
  else if (s.rp >= t.cost) state = paint(C.mag, 'disponível — Enter pesquisa');
  else {
    const rate = rpRate(s);
    const eta = rate > 0 ? ` (~${Math.ceil((t.cost - s.rp) / rate)} s)` : '';
    state = paint(C.dim, `faltam ${fmt(t.cost - s.rp)} PP${eta}`);
  }
  return [
    '   ' + paint(C.bold, t.name) + ' — ' + effect,
    '   ' + state,
  ];
}

export function render(ctx, height, width) {
  const s = ctx.state;
  ctx.ui.sel = Math.max(0, Math.min(ctx.ui.sel ?? 0, TREE.length - 1));
  const done = TECHS.filter((t) => bought(s, t.id)).length;
  const top = [
    '   ' + paint(C.bold, 'Árvore de pesquisa') + paint(C.dim, `  ${done}/${TECHS.length} concluídas`) +
      paint(C.dim, `  ·  rede ${fmt(capacity(s))} kW (excedente a ${Math.round(excessRate(s) * 100)}%)`),
  ];
  if (s.labs === 0) top.push(paint(C.dim, '   Construa um Laboratório (aba Geradores) para gerar Pontos de Pesquisa.'));
  const panel = detail(s, TREE[ctx.ui.sel].tech);
  const rows = TREE.map((node, i) => row(s, node, i === ctx.ui.sel, width));
  return [...top, ...scrollWindow(rows, ctx.ui.sel, height - top.length - panel.length), ...panel];
}

export function key(ctx, k) {
  const ui = ctx.ui;
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(TREE.length - 1, (ui.sel ?? 0) + 1); return true; }
  if (k === 'pageup') { ui.sel = Math.max(0, (ui.sel ?? 0) - 10); return true; }
  if (k === 'pagedown') { ui.sel = Math.min(TREE.length - 1, (ui.sel ?? 0) + 10); return true; }
  if (k !== 'enter') return false;
  const s = ctx.state;
  const t = TREE[ui.sel ?? 0].tech;
  if (bought(s, t.id)) ctx.say(`${t.name} já foi pesquisada.`, 'info');
  else if (missing(s, t).length) ctx.say(`Requer: ${missing(s, t).map(techName).join(', ')}.`, 'err');
  else if (buyTech(s, t.id)) ctx.say(`Pesquisado: ${t.name}!`, 'ok');
  else ctx.say(`Faltam ${fmt(t.cost - s.rp)} PP para ${t.name}.`, 'err');
  return true;
}
