import { C, paint } from '../theme.js';
import { visibleLength } from '../format.js';
import { LOGO, SUBTITLE, TAGLINE } from '../art/logo.js';

export const help = '↑↓ escolher  Enter confirmar  1-5 atalho  Q sair';

// `enabled(ctx)` desliga itens sem sentido no momento (ex.: Continuar sem jogo).
const ITEMS = [
  { label: 'Continuar', run: (ctx) => ctx.continueGame(), enabled: (ctx) => ctx.canContinue },
  { label: 'Novo jogo', run: (ctx) => ctx.openSlots('new') },
  { label: 'Carregar slot', run: (ctx) => ctx.openSlots('load') },
  { label: 'Opções', run: (ctx) => ctx.go('options') },
  { label: 'Sair', run: (ctx) => ctx.quit() },
];
const isEnabled = (ctx, it) => !it.enabled || it.enabled(ctx);

const center = (text, cols) => ' '.repeat(Math.max(0, Math.floor((cols - visibleLength(text)) / 2))) + text;

// Ao abrir, a seleção começa no primeiro item disponível (Continuar ou Novo jogo).
// Chamada no render e na tecla: uma tecla pode chegar antes do primeiro quadro.
function initSel(ctx) {
  const ui = ctx.ui;
  if (ui.sel === undefined || !isEnabled(ctx, ITEMS[ui.sel])) ui.sel = ITEMS.findIndex((it) => isEnabled(ctx, it));
}

export function render(ctx, height, cols) {
  const ui = ctx.ui;
  initSel(ctx);

  const lines = [
    ...LOGO.map((l) => center(paint(C.bold + C.green, l), cols)),
    center(paint(C.cyan, SUBTITLE), cols),
    center(paint(C.dim, TAGLINE), cols),
    '',
  ];
  // Itens alinhados à esquerda num bloco centralizado (fica mais limpo que centralizar
  // cada linha, que deixaria o marcador "▸" pulando de coluna).
  const width = 22;
  const left = ' '.repeat(Math.max(0, Math.floor((cols - width) / 2)));
  ITEMS.forEach((it, i) => {
    const on = isEnabled(ctx, it);
    const selected = i === ui.sel;
    const text = `${selected ? '▸' : ' '} ${i + 1}  ${it.label}`;
    const style = !on ? C.dim : selected ? C.bold + C.yellow : '';
    lines.push(left + paint(style, text));
  });
  const top = Math.max(0, Math.floor((height - lines.length) / 2));
  return [...Array(top).fill(''), ...lines];
}

function move(ctx, dir) {
  let i = ctx.ui.sel;
  for (let n = 0; n < ITEMS.length; n++) {
    i = (i + dir + ITEMS.length) % ITEMS.length;
    if (isEnabled(ctx, ITEMS[i])) break;
  }
  ctx.ui.sel = i;
}

export function key(ctx, k) {
  const ui = ctx.ui;
  initSel(ctx);
  if (k === 'up') { move(ctx, -1); return true; }
  if (k === 'down') { move(ctx, 1); return true; }
  const idx = k === 'enter' ? ui.sel : /^[1-9]$/.test(k) ? Number(k) - 1 : -1;
  const it = ITEMS[idx];
  if (!it) return false;
  if (!isEnabled(ctx, it)) { ctx.say('Nenhum jogo para continuar — escolha Novo jogo.', 'info'); return true; }
  ui.sel = idx;
  it.run(ctx);
  return true;
}
