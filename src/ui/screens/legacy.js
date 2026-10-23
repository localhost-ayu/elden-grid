// Item 0 é a ascensão; depois a loja e, por último, o Monumento (sem teto). A ascensão apaga a partida, então só acontece
// depois de uma prévia do que se ganha e do que se perde, com confirmação S/N.
import { LEGACY, SHOP, MONUMENT, RESEARCH_TIERS } from '../../data/legacy.js';
import { TECHS } from '../../data/research.js';
import { GENERATORS } from '../../data/generators.js';
import { offlineMax, chapterTechs } from '../../core/engine.js';
import {
  ascend, buyMonument, buyShop, canAscend, canVisit, visitBonus, minRunEarned, resolvePerk, gateMet, gateStatus, legacyGain, legacyMult, monumentCost, monumentMult, nextPointIn, nextShopCost, shopLevel,
} from '../../core/prestige.js';
import { C, paint, glyphs } from '../theme.js';
import * as empire from './empire.js';
import { fmt, bar } from '../format.js';
import { chapterDef } from '../../data/chapters.js';

export const confirmHelp = 'S confirmar  N/Esc cancelar';
export const help = (ctx) => {
  if (ctx.ui.confirm) return confirmHelp;
  if (ctx.ui.empire) return empire.help;
  // Com a visita disponível, os lembretes da manivela e do Q saem para caber em 80 colunas.
  if (canVisit(ctx.state)) return '↑↓ escolher  Enter ascender/comprar  T visitar a Terra  I império  M menu';
  return '↑↓ escolher  Enter ascender/comprar  I império  espaço gira  M menu  Q sair';
};

// "ao Sistema Solar", "à Galáxia".
const toChapter = (id) => `${id === 'galaxy' ? 'à' : 'ao'} ${chapterDef(id).name}`;
const pct = (m) => `${Math.round((m - 1) * 100)}%`;

const EFFECT = {
  start: (v, s) => `começa com ${v} ${s.chapter === 'earth' ? 'turbinas eólicas' : `da 1ª fonte (${GENERATORS.find((g) => g.chapter === s.chapter).short})`}`,
  cost: (v) => `geradores ${pct(v)} no preço`,
  lab: (v) => `pesquisa x${v}`,
  offline: (v) => `offline até ${v.hours} h a ${Math.round(v.rate * 100)}%`,
  auto: (v) => `auto-compra já no início (1 a cada ${v} s)`,
  crank: (v) => `manivela rende ${v} s de produção`,
  techs: (v, s) => `começa com ${RESEARCH_TIERS[s.chapter][v - 1].length} pesquisas prontas`,
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
  const visit = s.empire.visit;
  if (visit && canAscend(s)) {
    return [
      ' ' + paint(C.bold + C.yellow, `${mark} ${star} Concluir a visita: +${visit.bonus} pontos e voltar ${toChapter(visit.home)}`),
      paint(C.dim, '     A Terra foi concluída de novo. A próxima partida recomeça no capítulo de origem.'),
    ];
  }
  if (canAscend(s)) {
    const gain = legacyGain(s);
    const lines = [
      ' ' + paint(C.bold + C.yellow, `${mark} ${star} Ascender agora: +${gain} ${gain === 1 ? 'ponto' : 'pontos'}`) +
        paint(C.dim, `   próximo ponto em +$${fmt(nextPointIn(s))}`),
      paint(C.dim, '     Zera dinheiro, usinas, upgrades, pesquisas e calor; mantém Legado e loja.'),
    ];
    if (canVisit(s)) {
      lines.push(paint(C.dim, `     ou [T] ascender e visitar a Terra: concluí-la vale +${visitBonus(s)} pontos extras.`));
    }
    return lines;
  }
  const need = minRunEarned(s);
  const gl = glyphs();
  const check = (ok) => (ok ? paint(C.green, gl.dot) : paint(C.dim, gl.dotEmpty));
  const all = chapterTechs(s);
  const techs = all.filter((t) => s.techs[t.id]).length;
  const gate = gateStatus(s).map((c) => `${check(c.done)} ${paint(c.done ? C.green : C.dim, c.type === 'techs' ? `${c.label} (${techs}/${all.length})` : c.label)}`);
  const title = visit ? `Visita à Terra: +${visit.bonus} pontos ao concluir` : 'Ascender';
  return [
    ' ' + paint(selected ? C.bold : '', `${mark} ${star} ${title}`) +
      paint(C.dim, '   fecha a partida: as duas condições abaixo'),
    '     ' + check(s.earned >= need) + ' ' + paint(C.yellow, bar(s.earned / need, 20)) + paint(C.dim, `  $${fmt(s.earned)} / $${fmt(need)} ganhos`),
    '     ' + paint(C.dim, 'e') + ' ' + gate.join(paint(C.dim, '  ou  ')),
  ];
}

// O que falta para ascender, numa frase.
function missing(s) {
  const parts = [];
  if (s.earned < minRunEarned(s)) parts.push(`$${fmt(minRunEarned(s))} nesta partida`);
  if (!gateMet(s)) parts.push(gateStatus(s).map((c) => c.short).join(' ou '));
  return parts.join(' e ');
}

function shopRow(s, item, selected) {
  const lvl = shopLevel(s, item);
  const cost = nextShopCost(s, item);
  const max = item.costs.length;
  const i = cost == null ? max - 1 : lvl;
  const effect = resolvePerk(item.perks?.[i], s.chapter)?.desc ?? EFFECT[item.type](item.values[i], s);
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
  if (ctx.ui.empire) return empire.render(ctx);
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
    const visit = s.empire.visit;
    ui.confirm = {
      text: visit
        ? `Concluir a visita por +${gain} pontos e voltar ${toChapter(visit.home)}?`
        : `Ascender por +${gain} ${gain === 1 ? 'ponto' : 'pontos'}? A partida atual recomeça do zero.`,
      run: () => {
        const got = ascend(s);
        ctx.ascended();
        ctx.say(visit
          ? `Visita concluída: +${got} pontos de legado. De volta ${toChapter(s.chapter)}.`
          : `Ascensão ${s.legacy.ascensions}! +${got} pontos de legado (produção +${pct(legacyMult(s))}).`, 'ok', 8000);
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

// Ascender e levar a próxima partida à Terra (core/prestige.js ascend com `visit`).
function visitPrompt(ctx) {
  const s = ctx.state;
  if (s.chapter === 'earth') { ctx.say(s.empire.visit ? 'Você já está visitando a Terra: conclua-a para voltar.' : 'A visita à Terra é para quem já colonizou outro capítulo.', 'info'); return; }
  if (!canVisit(s)) { ctx.say(missing(s) ? `Para ascender e visitar a Terra: ${missing(s)}.` : 'Nada novo a ganhar ainda: o próximo ponto vem com mais dinheiro.', 'info'); return; }
  const gain = legacyGain(s);
  const bonus = visitBonus(s);
  ctx.ui.confirm = {
    text: `Ascender por +${gain} e visitar a Terra? Concluí-la vale +${bonus} e traz você de volta.`,
    run: () => {
      const got = ascend(s, { visit: true });
      ctx.ascended();
      ctx.say(`Ascensão ${s.legacy.ascensions}! +${got} pontos. Bem-vindo de volta à Terra: conclua-a por +${bonus}.`, 'ok', 8000);
    },
  };
}

export function key(ctx, k) {
  const ui = ctx.ui;
  if (ui.confirm) {
    // Enquanto a pergunta está na tela, nenhuma outra tecla vaza (nem q, nem m).
    if (k === 's' || k === 'S') { const { run } = ui.confirm; ui.confirm = null; run(); }
    else if (k === 'n' || k === 'N' || k === 'escape') ui.confirm = null;
    return true;
  }
  if (k === 'i' || k === 'I') { ui.empire = !ui.empire; return true; }
  if (ui.empire) return empire.key(ctx, k);
  if (k === 't' || k === 'T') { visitPrompt(ctx); return true; }
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(LAST, (ui.sel ?? 0) + 1); return true; }
  if (k === 'enter') { clampSel(ui); choose(ctx); return true; }
  return false;
}
