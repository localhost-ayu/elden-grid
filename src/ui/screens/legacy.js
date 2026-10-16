// Item 0 é a ascensão; os demais, a loja. A ascensão apaga a partida, então só acontece
// depois de uma prévia do que se ganha e do que se perde, com confirmação S/N.
import { LEGACY, SHOP } from '../../data/legacy.js';
import { offlineMax } from '../../core/engine.js';
import {
  ascend, buyShop, canAscend, legacyGain, legacyMult, nextPointIn, nextShopCost, shopLevel,
} from '../../core/prestige.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt, bar } from '../format.js';

export const confirmHelp = 'S confirmar  N/Esc cancelar';
export const help = (ctx) => (ctx.ui.confirm
  ? confirmHelp
  : '↑↓ escolher  Enter ascender/comprar  espaço manivela  Tab abas  M menu  Q sair');

const pct = (m) => `${Math.round((m - 1) * 100)}%`;

const EFFECT = {
  start: (v) => `começa com ${v} turbinas eólicas`,
  cost: (v) => `geradores ${pct(v)} no preço`,
  lab: (v) => `pesquisa x${v}`,
  offline: (v) => `offline até ${v.hours} h a ${Math.round(v.rate * 100)}%`,
  auto: (v) => `auto-compra já no início (1 a cada ${v} s)`,
  crank: (v) => `manivela rende ${v} s de produção`,
  techs: (v) => `começa com ${v.length} pesquisas prontas`,
  cooling: (v) => `reatores começam com ${v} ${v === 1 ? 'resfriamento' : 'resfriamentos'}`,
  damage: (v) => (v === 0 ? 'crises perdidas não custam nada' : `crises perdidas custam ${pct(v)}`),
  milestones: (v) => `marcos com ${pct(v).replace('-', '')} menos unidades`,
  transformers: (v) => `começa com ${v} ${v === 1 ? 'transformador' : 'transformadores'}`,
};

const clampSel = (ui) => (ui.sel = Math.max(0, Math.min(ui.sel ?? 0, SHOP.length)));

function ascendBlock(s, selected) {
  const mark = selected ? '›' : ' ';
  const star = glyphs().legacy;
  if (canAscend(s)) {
    const gain = legacyGain(s);
    return [
      ' ' + paint(C.bold + C.yellow, `${mark} ${star} Ascender agora: +${gain} ${gain === 1 ? 'ponto' : 'pontos'}`) +
        paint(C.dim, `   próximo ponto em +$${fmt(nextPointIn(s))}`),
      paint(C.dim, '     Zera dinheiro, usinas, upgrades, pesquisas e calor; mantém Legado e loja.'),
    ];
  }
  const need = LEGACY.minRunEarned;
  return [
    ' ' + paint(selected ? C.bold : '', `${mark} ${star} Ascender`) +
      paint(C.dim, `   disponível após ganhar $${fmt(need)} nesta partida`),
    '     ' + paint(C.yellow, bar(s.earned / need, 30)) + paint(C.dim, `  $${fmt(s.earned)} / $${fmt(need)}`),
  ];
}

function shopRow(s, item, selected) {
  const lvl = shopLevel(s, item);
  const cost = nextShopCost(s, item);
  const max = item.costs.length;
  const next = cost == null ? item.values[max - 1] : item.values[lvl];
  const effect = EFFECT[item.type](next);
  const price = cost == null ? 'completo ✓' : `${cost} ${glyphs().legacy}`;
  const text = `${selected ? '›' : ' '} ${item.name.padEnd(19)} ${`${lvl}/${max}`.padStart(3)}  ${effect.padEnd(40)} ${price.padStart(10)}`;
  const style = cost == null ? C.dim + C.green : s.legacy.points >= cost ? C.yellow : C.dim;
  return ' ' + paint(style + (selected ? C.bold : ''), text);
}

// A loja rola sob um cabeçalho fixo (pontos e ascensão), mantendo a seleção à vista.
// `ui.top` = primeiro item da loja visível.
function shopWindow(ui, rows, room) {
  if (rows.length <= room) return { shown: rows, more: '' };
  const view = Math.max(1, room - 1); // uma linha para o indicador
  const i = Math.max(0, (ui.sel ?? 0) - 1);
  ui.top = Math.max(0, Math.min(ui.top ?? 0, rows.length - view));
  if (i < ui.top) ui.top = i;
  if (i >= ui.top + view) ui.top = i - view + 1;
  const end = Math.min(rows.length, ui.top + view);
  const more = paint(C.dim, `   itens ${ui.top + 1}–${end} de ${rows.length}  (↑↓ rola)`);
  return { shown: rows.slice(ui.top, end), more };
}

export function render(ctx, height = Infinity) {
  const s = ctx.state;
  const ui = ctx.ui;
  const sel = clampSel(ui);
  const L = s.legacy;
  const head = [
    '   ' + paint(C.bold + C.yellow, `${glyphs().legacy} ${L.points} ${L.points === 1 ? 'ponto' : 'pontos'} de legado`) +
      paint(C.dim, `  →  produção +${pct(legacyMult(s))}`) +
      paint(C.dim, `  ·  ascensões ${L.ascensions}  ·  offline até ${offlineMax(s) / 3600} h`),
    paint(C.dim, `   Ponto não gasto = +${Math.round(LEGACY.bonusPerPoint * 100)}% de produção. Gastar na loja troca bônus por vantagens.`),
    '',
    ...ascendBlock(s, sel === 0),
    '',
    '   ' + paint(C.bold, 'Loja do Legado') + paint(C.dim, ' '.repeat(16) + 'nível  próximo nível'),
  ];
  const confirm = ui.confirm ? ['', '   ' + paint(C.yellow + C.bold, ui.confirm.text) + '  ' + paint(C.bold, '(S/N)')] : [];
  const rows = SHOP.map((item, i) => shopRow(s, item, sel === i + 1));
  const { shown, more } = shopWindow(ui, rows, height - head.length - confirm.length);
  return [...head, ...shown, ...(more ? [more] : []), ...confirm];
}

function choose(ctx) {
  const s = ctx.state;
  const ui = ctx.ui;
  if (ui.sel === 0) {
    if (!canAscend(s)) {
      ctx.say(`Ascensão disponível após ganhar $${fmt(LEGACY.minRunEarned)} nesta partida.`, 'info');
      return;
    }
    const gain = legacyGain(s);
    ui.confirm = {
      text: `Ascender por +${gain} ${gain === 1 ? 'ponto' : 'pontos'}? A partida atual recomeça do zero.`,
      run: () => {
        const got = ascend(s);
        ctx.ascended();
        ctx.say(`Ascensão ${s.legacy.ascensions}! +${got} pontos de legado (produção +${pct(legacyMult(s))}).`, 'ok', 8000);
      },
    };
    return;
  }
  const item = SHOP[ui.sel - 1];
  const cost = nextShopCost(s, item);
  if (cost == null) ctx.say(`${item.name}: completo.`, 'info');
  else if (buyShop(s, item.id)) ctx.say(`Legado: ${item.name} nível ${shopLevel(s, item)}.`, 'ok');
  else {
    const n = cost - s.legacy.points;
    ctx.say(`${n === 1 ? 'Falta 1 ponto' : `Faltam ${n} pontos`} para ${item.name}.`, 'err');
  }
}

export function key(ctx, k) {
  const ui = ctx.ui;
  if (ui.confirm) {
    // Enquanto a pergunta está na tela, nenhuma outra tecla vaza (nem q, nem m).
    if (k === 's' || k === 'S') { const { run } = ui.confirm; ui.confirm = null; run(); }
    else if (k === 'n' || k === 'N' || k === 'escape') ui.confirm = null;
    return true;
  }
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(SHOP.length, (ui.sel ?? 0) + 1); return true; }
  if (k === 'enter') { clampSel(ui); choose(ctx); return true; }
  return false;
}
