import { GENERATORS, LAB } from '../../data/generators.js';
import { chapterIndex } from '../../data/chapters.js';
import { TECHS } from '../../data/research.js';
import {
  power, genPower, rpRate, genUnlocked, labUnlocked, genEnv, genBulk, labBulk, genAffordable, genLaunch, feedFactor,
  genModMult, milestones, nextMilestone, nextUpgrade, upgradeLevel, upgradeTrack,
} from '../../core/engine.js';
import { isDay, reservoirLevel, tideRising, lunarIsDay, haulIn } from '../../core/traits.js';
import { heatLevel, isShutdown, shutdownLeft } from '../../core/heat.js';
import { buyGenBulk, buyLabBulk, buyUpgrade } from '../../core/actions.js';
import { autoAvailable, autoInterval, toggleAuto } from '../../core/automation.js';
import { genDisabled } from '../../core/challenges.js';
import { C, paint } from '../theme.js';
import { fmt, visibleLength } from '../format.js';
import { scrollWindow } from '../list.js';
import { CARD_H, sceneCards, sceneRows } from '../scene.js';

export const help = (ctx) => (ctx.ui.scene
  ? 'V volta à lista  0-9 comprar  B lote  espaço gira  Tab abas  M menu  Q sair'
  : '↑↓ Enter comprar  B lote  U upgrade  V cena  0-9 atalho  espaço gira  Q sair');

// Cada capítulo é uma página de fontes (data/generators.js): a aba mostra a do capítulo
// atual, e as teclas 0–9 valem para ela.
const pageOf = (ctx) => chapterIndex(ctx.state.chapter);

// Modo de lote é estado de UI por sessão: não vai para o save.
const BULK = [1, 10, 100, 'max'];
const bulkLabel = (a) => (a === 'max' ? 'MAX' : `x${a}`);
const bulkOf = (ui) => BULK[ui.bulk ?? 0];

const x = (f) => `${f.toFixed(2)}x`;
const TRAIT_LABEL = {
  wind: (s, g) => `vento ${x(genEnv(s, g))}`,
  daylight: (s, g) => `${isDay(s) ? '☼ dia' : '☾ noite'} ${x(genEnv(s, g))}`,
  reservoir: (s, g, tr) => `reserv. ${Math.round(reservoirLevel(s, tr) * 100)}% ${x(genEnv(s, g))}`,
  tide: (s, g, tr) => `maré ${tideRising(s, tr) ? '▲' : '▼'} ${x(genEnv(s, g))}`,
  // Por unidade, já com desconto de upgrades de eficiência.
  upkeep: (s, g, tr) => `-$${fmt(tr.money * genModMult(s, g, 'upkeep'))}/s`,
  heat: (s, g) => `calor ${Math.round(heatLevel(s, g) * 100)}%`,
  vacuum: (s, g) => `flutuação ${x(genEnv(s, g))}`,
  lunarDay: (s, g, tr) => `${lunarIsDay(s, tr) ? 'dia' : 'noite'} lunar ${x(genEnv(s, g))}`,
  haul: (s, g, tr) => (genEnv(s, g) > 1 ? `CARGA ${x(genEnv(s, g))}` : `carga em ${Math.ceil(haulIn(s, tr))}s`),
  feed: (s, g) => `alimentação ${Math.round(feedFactor(s, g) * 100)}%`,
  launch: (s, g) => {
    const w = genLaunch(s, g);
    return w.open ? `janela aberta ${Math.ceil(w.left)}s` : `lançamento em ${Math.ceil(w.left)}s`;
  },
};
// Desligado por superaquecimento é a informação mais urgente: aparece sozinha.
const condition = (s, g) => (isShutdown(s, g)
  ? `DESLIGADO ${Math.ceil(shutdownLeft(s, g))}s`
  : g.traits.map((tr) => TRAIT_LABEL[tr.type]?.(s, g, tr) ?? '').join(' ') || 'estável');

// Versão de uma linha da cena, para quando não sobra altura para os cards. Com muitas
// fontes, repete menos ícones por fonte até caber na largura; em último caso corta com "…".
function plantRow(s, cols) {
  const owned = GENERATORS.filter((g) => g.chapter === s.chapter && s.owned[g.id] > 0);
  if (!owned.length && !s.labs) return ' ' + paint(C.dim, '(nenhuma usina ainda)');
  const room = cols - 2;
  let text = '';
  for (const reps of [6, 3, 1]) {
    const parts = owned.map((g) => `${g.icon.repeat(Math.min(s.owned[g.id], reps))} x${s.owned[g.id]}`);
    if (s.labs > 0) parts.push(`{LAB} x${s.labs}`);
    text = parts.join(reps > 1 ? '   ' : '  ');
    if (visibleLength(text) <= room) break;
  }
  if (visibleLength(text) > room) text = [...text].slice(0, room - 1).join('') + '…';
  return ' ' + paint(C.yellow, text);
}

// Itens compráveis visíveis agora na página. A seleção é por índice nesta lista, então
// ela é recalculada a cada quadro (um gerador novo pode ter sido destravado). O
// laboratório aparece em todas as páginas.
function items(s, page = chapterIndex(s.chapter)) {
  const list = GENERATORS.filter((g) => g.page === page && genUnlocked(g, s)).map((g) => ({ gen: g }));
  if (labUnlocked(s)) list.push({ lab: true });
  return list;
}

const cols = (mark, key, name, qty, out, cost, cond) =>
  `${mark} ${key} ${name.padEnd(18)} ${qty.padEnd(5)} ${out.padStart(11)} ${cost.padStart(13)}  ${cond}`;
const header = (amount) => cols(' ', '   ', 'fonte', 'qtd', 'por unid.', `custo ${bulkLabel(amount)}`, 'condição');

// Custo exibido: no MAX mostra quantas unidades entram ("x37 $1.2k"); sem saldo para
// nenhuma, mostra o preço de 1 (apagado), para o jogador saber quanto falta.
const costText = (b, amount) => (amount === 'max' && b.ok ? `x${b.n} $${fmt(b.cost)}` : `$${fmt(b.cost)}`);

function row(s, it, selected, amount) {
  const mark = selected ? '›' : ' ';
  let line;
  let b;
  let color;
  if (it.lab) {
    b = labBulk(s, amount);
    line = cols(mark, '[ ]', LAB.name, 'x' + s.labs, `+${LAB.rpPerSec} PP/s`, costText(b, amount), 'pesquisa');
    color = C.mag;
  } else {
    const g = it.gen;
    b = genBulk(s, g, amount);
    // "por unid." já inclui pesquisas, upgrades e marcos (sem o ambiente, que está em "condição").
    const out = g.output * genModMult(s, g, 'output');
    line = cols(mark, `[${g.key}]`, g.name, 'x' + s.owned[g.id], `+${fmt(out)} kW`, costText(b, amount), condition(s, g));
    color = C.green;
  }
  const style = (b.ok ? color : C.dim) + (selected ? C.bold : '');
  return ' ' + paint(style, line);
}

const EFFECT_TEXT = {
  output: (m) => `produção x${m}`,
  cost: (m) => `custo ${Math.round((m - 1) * 100)}%`,
  upkeep: (m) => `operação ${Math.round((m - 1) * 100)}%`,
};
const effectText = (u) => u.effects.map((e) => EFFECT_TEXT[e.type](e.mult)).join(', ');

function detail(s, it) {
  if (it.lab) {
    return [
      '   ' + paint(C.mag, `${LAB.name}: +${fmt(rpRate(s))} PP/s no total`) + paint(C.dim, `   cabem ${labBulk(s, 'max').n} no saldo`),
      paint(C.dim, '   (o laboratório não tem upgrades; a pesquisa acelera os PP)'),
    ];
  }
  const g = it.gen;
  const m = nextMilestone(s, g);
  const ms = m ? `próximo marco ${s.owned[g.id]}/${m.at} → x${m.mult}` : 'todos os marcos ✓';
  const l1 = '   ' + paint(C.green, `${g.name}: ${fmt(genPower(s, g))} kW`) + paint(C.dim, `   ${ms}   cabem ${genAffordable(s, g)} no saldo`);
  const u = nextUpgrade(s, g);
  const lvl = `${upgradeLevel(s, g)}/${upgradeTrack(g).length}`;
  let l2;
  if (!u) l2 = paint(C.dim, `   Upgrades completos ${lvl} ✓`);
  else if (s.owned[g.id] < 1) l2 = paint(C.dim, `   Upgrades ${lvl}: compre 1 unidade para liberar`);
  else {
    l2 = '   ' + paint(s.money >= u.cost ? C.yellow : C.dim, `[U] nv ${u.level}/${upgradeTrack(g).length} ${u.name} — ${effectText(u)} — $${fmt(u.cost)}`);
  }
  return [l1, l2];
}

// Prévia da próxima fonte ainda bloqueada: mostra ao jogador o que perseguir.
// Fontes desligadas por um desafio não entram: elas nunca vão abrir nesta partida.
function teaser(s) {
  const g = GENERATORS.find((x) => x.chapter === s.chapter && !genUnlocked(x, s) && !genDisabled(s, x));
  if (!g) return [];
  const tech = TECHS.find((t) => t.id === g.unlock);
  return [' ' + paint(C.dim, `${cols(' ', `[${g.key}]`, g.name, '', '', '', '').trimEnd()} — requer pesquisa: ${tech.name}`)];
}

function autoLine(s) {
  if (!autoAvailable(s)) return [];
  const iv = autoInterval(s);
  const rate = iv < 1 ? `${Math.round(1 / iv)} por s` : `1 a cada ${iv} s`;
  return s.auto.buy
    ? ['   ' + paint(C.cyan, `⟳ Auto-compra ligada`) + paint(C.dim, ` · ${rate} · fonte mais barata · [A] desliga`)]
    : ['   ' + paint(C.dim, `⟳ Auto-compra desligada · [A] liga`)];
}

const clampSel = (ui, n) => (ui.sel = Math.max(0, Math.min(ui.sel ?? 0, n - 1)));

// A cena inteira mostra as usinas do capítulo atual.
function sceneView(ctx, height, width) {
  const s = ctx.state;
  const page = pageOf(ctx);
  const types = sceneCards(s, page).length;
  const top = ' ' + paint(C.bold, 'Usinas') + paint(C.dim, `  ${fmt(power(s))} kW · ${types} ${types === 1 ? 'tipo' : 'tipos'}  ·  V volta à lista`);
  ctx.ui.particleZone = null;
  if (!types) return [top, '', paint(C.dim, '   Nenhuma usina ainda — compre a primeira na lista (V).')];
  const rows = sceneRows(s, ctx.anim, width, Math.floor((height - 1) / CARD_H), page);
  ctx.ui.particleZone = { top: 1, height: rows.length };
  return [top, ...rows];
}

export function render(ctx, height, width) {
  if (ctx.ui.scene) return sceneView(ctx, height, width);
  const s = ctx.state;
  const amount = bulkOf(ctx.ui);
  const page = pageOf(ctx);
  const list = items(s, page);
  const sel = clampSel(ctx.ui, list.length);
  const rows = list.map((it, i) => row(s, it, i === sel, amount));
  const panel = detail(s, list[sel]);
  // Prioridade de altura: cabeçalho + lista + painel são essenciais; depois entram,
  // se couber, a prévia/aviso do lab e a cena (cards inteiros, ou a linha de ícones).
  const extra = [...autoLine(s), ...teaser(s)];
  if (!labUnlocked(s)) extra.push(paint(C.dim, `   Laboratório aparece após ${LAB.unlockAt} kWh produzidos.`));
  let room = height - 1 - panel.length - rows.length;
  const shownExtra = room >= extra.length ? extra : [];
  room -= shownExtra.length;
  // Os cards acima da lista são os do capítulo atual.
  const cardRows = sceneCards(s, page).length ? Math.floor(room / CARD_H) : 0;
  const scene = cardRows ? sceneRows(s, ctx.anim, width, cardRows, page) : [];
  const plant = !scene.length && room >= 1 ? [plantRow(s, width)] : [];
  const listRoom = height - 1 - panel.length - shownExtra.length - plant.length - scene.length;
  // As partículas de venda/manivela saem das usinas, nunca do meio da lista.
  const zone = scene.length || plant.length;
  ctx.ui.particleZone = zone ? { top: 0, height: zone } : null;
  return [
    ...scene, ...plant,
    ' ' + paint(C.dim, header(amount)),
    ...scrollWindow(rows, sel, listRoom),
    ...panel,
    ...shownExtra,
  ];
}

const plural = (n, name) => (n > 1 ? `${n}× ${name}` : name);

function buy(ctx, it) {
  const s = ctx.state;
  const amount = bulkOf(ctx.ui);
  if (it.lab) {
    const n = buyLabBulk(s, amount);
    if (n) return ctx.say(`${plural(n, 'Laboratório')} construído${n > 1 ? 's' : ''}!`, 'ok');
    return ctx.say(`Sem dinheiro para ${bulkLabel(amount)} Laboratório ($${fmt(labBulk(s, amount).cost)}).`, 'err');
  }
  const g = it.gen;
  if (genDisabled(s, g)) return ctx.say(`${g.name} está desligada neste desafio.`, 'err');
  if (!genUnlocked(g, s)) return ctx.say(`${g.name} ainda está bloqueado (pesquisa).`, 'err');
  const w = genLaunch(s, g);
  if (w && !w.open) return ctx.say(`${g.name}: a próxima janela de lançamento abre em ${Math.ceil(w.left)} s.`, 'err');
  const before = s.owned[g.id];
  const n = buyGenBulk(s, g.id, amount);
  if (!n) return ctx.say(`Sem dinheiro para ${bulkLabel(amount)} ${g.name} ($${fmt(genBulk(s, g, amount).cost)}).`, 'err');
  ctx.say(`Comprou ${plural(n, g.name)}!`, 'ok');
  // Um lote grande pode cruzar mais de um marco de uma vez.
  for (const m of milestones(s)) {
    if (before < m.at && s.owned[g.id] >= m.at) ctx.say(`Marco! ${m.at}× ${g.name}: produção x${m.mult}`, 'ok', 6000);
  }
}

function upgrade(ctx, it) {
  const s = ctx.state;
  if (it.lab) return ctx.say('O laboratório não tem upgrades.', 'info');
  const g = it.gen;
  const u = nextUpgrade(s, g);
  if (!u) return ctx.say(`${g.name}: upgrades completos.`, 'info');
  if (s.owned[g.id] < 1) return ctx.say(`Compre ao menos 1 ${g.name} antes do upgrade.`, 'err');
  if (buyUpgrade(s, g.id)) return ctx.say(`Upgrade: ${u.name} (${g.name}) — ${effectText(u)}!`, 'ok');
  return ctx.say(`Faltam $${fmt(u.cost - s.money)} para ${u.name}.`, 'err');
}

export function key(ctx, k) {
  const ui = ctx.ui;
  const page = pageOf(ctx);
  const list = items(ctx.state, page);
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(list.length - 1, (ui.sel ?? 0) + 1); return true; }
  if (k === 'enter') { clampSel(ui, list.length); buy(ctx, list[ui.sel]); return true; }
  if (k === 'v' || k === 'V') { ui.scene = !ui.scene; return true; }
  if (k === 'b' || k === 'B') {
    ui.bulk = ((ui.bulk ?? 0) + 1) % BULK.length;
    ctx.say(`Compra em lote: ${bulkLabel(bulkOf(ui))}`, 'info', 2000);
    return true;
  }
  if (k === 'u' || k === 'U') { clampSel(ui, list.length); upgrade(ctx, list[ui.sel]); return true; }
  if (k === 'a' || k === 'A') {
    if (!toggleAuto(ctx.state)) ctx.say('Auto-compra requer a pesquisa Automação Industrial.', 'err');
    else ctx.say(`Auto-compra ${ctx.state.auto.buy ? 'ligada' : 'desligada'}.`, 'info', 2000);
    return true;
  }
  const g = GENERATORS.find((x) => x.page === page && x.key === k);
  if (g) { buy(ctx, { gen: g }); return true; }
  return false;
}
