// Item 0 é a ascensão; depois a loja e, por último, o Monumento (sem teto). A ascensão apaga a partida, então só acontece
// depois de uma prévia do que se ganha e do que se perde, com confirmação S/N.
import { LEGACY, SHOP, MONUMENT } from '../../data/legacy.js';
import { TECHS } from '../../data/research.js';
import { offlineMax, chapterTechs } from '../../core/engine.js';
import {
  ascend, buyMonument, buyShop, canAscend, gateMet, gateStatus, legacyGain, legacyMult, monumentCost, monumentMult, nextPointIn, nextShopCost, shopLevel,
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
  damage: (v) => `crises perdidas custam ${pct(v)}`,
  milestones: (v) => `marcos com ${pct(v).replace('-', '')} menos unidades`,
  transformers: (v) => `começa com ${v} ${v === 1 ? 'transformador' : 'transformadores'}`,
  crew: (v) => `equipe de manutenção já contratada, a ${Math.round(v * 100)}%`,
  banks: (v) => `começa com ${v} ${v === 1 ? 'banco' : 'bancos'} de bateria`,
};

const LAST = SHOP.length + 1; // índice do Monumento
const clampSel = (ui) => (ui.sel = Math.max(0, Math.min(ui.sel ?? 0, LAST)));
const times = (m) => `x${m < 100 ? m.toFixed(2) : fmt(m)}`;

function ascendBlock(s, selected) {
  const mark = selected ? '›' : ' ';
  const star = glyphs().legacy;
  if (s.run) {
    return [
      ' ' + paint(selected ? C.bold : C.dim, `${mark} ${star} Sem ascensão nesta partida`),
      paint(C.dim, '     Desafios e semente do dia começam e terminam sem legado. A meta está no topo.'),
    ];
  }
  if (canAscend(s)) {
    const gain = legacyGain(s);
    return [
      ' ' + paint(C.bold + C.yellow, `${mark} ${star} Ascender agora: +${gain} ${gain === 1 ? 'ponto' : 'pontos'}`) +
        paint(C.dim, `   próximo ponto em +$${fmt(nextPointIn(s))}`),
      paint(C.dim, '     Zera dinheiro, usinas, upgrades, pesquisas e calor; mantém Legado e loja.'),
    ];
  }
  const need = LEGACY.minRunEarned;
  const gl = glyphs();
  const check = (ok) => (ok ? paint(C.green, gl.dot) : paint(C.dim, gl.dotEmpty));
  const all = chapterTechs(s);
  const techs = all.filter((t) => s.techs[t.id]).length;
  const gate = gateStatus(s).map((c) => `${check(c.done)} ${paint(c.done ? C.green : C.dim, c.type === 'techs' ? `${c.label} (${techs}/${all.length})` : c.label)}`);
  return [
    ' ' + paint(selected ? C.bold : '', `${mark} ${star} Ascender`) +
      paint(C.dim, '   fecha a partida: as duas condições abaixo'),
    '     ' + check(s.earned >= need) + ' ' + paint(C.yellow, bar(s.earned / need, 20)) + paint(C.dim, `  $${fmt(s.earned)} / $${fmt(need)} ganhos`),
    '     ' + paint(C.dim, 'e') + ' ' + gate.join(paint(C.dim, '  ou  ')),
  ];
}

// O que falta para ascender, numa frase.
function missing(s) {
  const parts = [];
  if (s.earned < LEGACY.minRunEarned) parts.push(`$${fmt(LEGACY.minRunEarned)} nesta partida`);
  if (!gateMet(s)) parts.push(gateStatus(s).map((c) => c.short).join(' ou '));
  return parts.join(' e ');
}

function shopRow(s, item, selected) {
  const lvl = shopLevel(s, item);
  const cost = nextShopCost(s, item);
  const max = item.costs.length;
  const i = cost == null ? max - 1 : lvl;
  const effect = item.perks?.[i]?.desc ?? EFFECT[item.type](item.values[i]);
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

function monumentRow(s, selected) {
  const lvl = s.legacy.monument;
  const cost = monumentCost(s);
  const effect = `produção ${times(monumentMult(s))} → ${times(monumentMult(s) * MONUMENT.mult)}`;
  const text = `${selected ? '›' : ' '} ${MONUMENT.name.padEnd(19)} ${String(lvl).padStart(3)}  ${effect.padEnd(40)} ${`${cost} ${glyphs().legacy}`.padStart(10)}`;
  return ' ' + paint((s.legacy.points >= cost ? C.yellow : C.dim) + (selected ? C.bold : ''), text);
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
  const rows = [...SHOP.map((item, i) => shopRow(s, item, sel === i + 1)), monumentRow(s, sel === LAST)];
  const { shown, more } = shopWindow(ui, rows, height - head.length - confirm.length);
  return [...head, ...shown, ...(more ? [more] : []), ...confirm];
}

function choose(ctx) {
  const s = ctx.state;
  const ui = ctx.ui;
  if (ui.sel === 0) {
    if (s.run) { ctx.say('Desafios não têm ascensão: a meta da partida está no topo da tela.', 'info'); return; }
    if (!canAscend(s)) {
      ctx.say(missing(s) ? `Para ascender: ${missing(s)}.` : 'Nada novo a ganhar ainda: o próximo ponto vem com mais dinheiro.', 'info');
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
  if (ui.sel === LAST) {
    const cost = monumentCost(s);
    if (buyMonument(s)) ctx.say(`${MONUMENT.name} nível ${s.legacy.monument}: produção ${times(monumentMult(s))}.`, 'ok');
    else ctx.say(`${cost - s.legacy.points === 1 ? 'Falta 1 ponto' : `Faltam ${cost - s.legacy.points} pontos`} para o próximo nível do ${MONUMENT.name}.`, 'err');
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
  if (k === 'down') { ui.sel = Math.min(LAST, (ui.sel ?? 0) + 1); return true; }
  if (k === 'enter') { clampSel(ui); choose(ctx); return true; }
  return false;
}
