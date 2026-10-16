import { C, paint, glyphs } from '../theme.js';
import { visibleLength } from '../format.js';
import { titleArt, ringOrder, TAGLINE, MOTTO } from '../art/logo.js';
import { frame } from '../anim.js';

export const help = '↑↓ escolher  Enter confirmar  1-5 atalho  \\ disfarce  Q sair';

// `enabled(ctx)` desliga itens sem sentido no momento (ex.: Continuar sem jogo).
const ITEMS = [
  { label: 'Continuar', run: (ctx) => ctx.continueGame(), enabled: (ctx) => ctx.canContinue },
  { label: 'Novo jogo', run: (ctx) => ctx.openSlots('new') },
  { label: 'Carregar slot', run: (ctx) => ctx.openSlots('load') },
  { label: 'Opções', run: (ctx) => ctx.go('options') },
  { label: 'Sair', run: (ctx) => ctx.quit() },
];
const isEnabled = (ctx, it) => !it.enabled || it.enabled(ctx);

const ART = titleArt();
const RING = ringOrder(ART);
const GLINT_TRAIL = 4;

// Letras douradas na frente, anel dourado esmaecido atrás, e um brilho com rastro que
// percorre o anel (parado quando as animações estão desligadas).
function title(anim) {
  const head = anim ? frame(anim, 14) % RING.length : -1;
  const lit = new Map();
  for (let i = 0; head >= 0 && i < GLINT_TRAIL; i++) {
    const c = RING[(head - i + RING.length) % RING.length];
    lit.set(`${c.x},${c.y}`, i);
  }
  return ART.map((row, y) => {
    let out = '';
    let run = '';
    let style = null;
    const flush = () => { if (run) out += paint(style, run); run = ''; };
    row.forEach((cell, x) => {
      const glow = lit.get(`${x},${y}`);
      const st = !cell.ring ? C.bold + C.yellow : glow === 0 ? C.bold + C.yellow + C.inverse : glow !== undefined ? C.bold + C.yellow : C.dim + C.yellow;
      if (cell.ch === ' ') { flush(); out += ' '; return; }
      if (st !== style) { flush(); style = st; }
      run += cell.ch;
    });
    flush();
    return out;
  });
}

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
    ...title(ctx.anim).map((l) => center(l, cols)),
    '',
    center(paint(C.yellow, TAGLINE), cols),
    center(paint(C.dim, MOTTO), cols),
    '',
  ];
  // Itens alinhados à esquerda num bloco centralizado (fica mais limpo que centralizar
  // cada linha, que deixaria o marcador pulando de coluna). O marcador é o ✦ dos locais
  // de descanso do jogo homenageado.
  const width = 22;
  const left = ' '.repeat(Math.max(0, Math.floor((cols - width) / 2)));
  ITEMS.forEach((it, i) => {
    const on = isEnabled(ctx, it);
    const selected = i === ui.sel;
    const text = `${selected ? glyphs().legacy : ' '} ${i + 1}  ${it.label}`;
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
