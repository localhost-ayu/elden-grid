import { GENERATORS, LAB } from '../../data/generators.js';
import { TECHS } from '../../data/research.js';
import { MILESTONES } from '../../data/upgrades.js';
import {
  power, genPower, rpRate, genUnlocked, labUnlocked, genEnv, genBulk, labBulk, genAffordable,
  genModMult, nextMilestone, nextUpgrade, upgradeLevel, upgradeTrack,
} from '../../core/engine.js';
import { isDay, reservoirLevel, tideRising } from '../../core/traits.js';
import { heatLevel, isShutdown, shutdownLeft } from '../../core/heat.js';
import { buyGenBulk, buyLabBulk, buyUpgrade } from '../../core/actions.js';
import { autoAvailable, autoInterval, toggleAuto } from '../../core/automation.js';
import { C, paint } from '../theme.js';
import { fmt, visibleLength } from '../format.js';
import { scrollWindow } from '../list.js';
import { BLADES, TOWER } from '../art/wind.js';

export const help = '↑↓/Enter comprar  B lote  U upgrade  0-9 atalho  espaço gira  M menu  Q sair';

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
};
// Desligado por superaquecimento é a informação mais urgente: aparece sozinha.
const condition = (s, g) => (isShutdown(s, g)
  ? `DESLIGADO ${Math.ceil(shutdownLeft(s, g))}s`
  : g.traits.map((tr) => TRAIT_LABEL[tr.type]?.(s, g, tr) ?? '').join(' ') || 'estável');

function windScene(count, now, pw) {
  const n = Math.max(1, Math.min(count, 5));
  const speed = Math.min(8, 1.5 + Math.log10(pw + 1) * 2); // mais potência = gira mais rápido
  const rows = Array.from({ length: 7 }, () => '');
  for (let i = 0; i < n; i++) {
    const frame = Math.floor((now / 1000) * speed + i) % 2; // +i desincroniza as turbinas
    const art = [...BLADES[count === 0 ? 1 : frame], ...TOWER];
    art.forEach((line, r) => (rows[r] += line + '  '));
  }
  const color = count === 0 ? C.dim : C.cyan;
  return rows.map((r) => ' ' + paint(color, r));
}

// Eólica fica de fora: tem a cena própria. Com muitas fontes, repete menos ícones por
// fonte até caber na largura; em último caso corta com "…".
function plantRow(s, cols) {
  const owned = GENERATORS.filter((g) => s.owned[g.id] > 0 && g.id !== 'wind');
  if (!owned.length && !s.labs) return ' ' + paint(C.dim, '(nenhuma outra usina ainda)');
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

// Itens compráveis visíveis agora. A seleção é por índice nesta lista, então ela é
// recalculada a cada quadro (um gerador novo pode ter sido destravado).
function items(s) {
  const list = GENERATORS.filter((g) => genUnlocked(g, s)).map((g) => ({ gen: g }));
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
function teaser(s) {
  const g = GENERATORS.find((x) => !genUnlocked(x, s));
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

export function render(ctx, height, width) {
  const s = ctx.state;
  const amount = bulkOf(ctx.ui);
  const list = items(s);
  const sel = clampSel(ctx.ui, list.length);
  const rows = list.map((it, i) => row(s, it, i === sel, amount));
  const panel = detail(s, list[sel]);
  // Prioridade de altura: cabeçalho + lista + painel são essenciais; depois entram,
  // se couber, a prévia/aviso do lab, a linha de ícones e por fim a cena das turbinas.
  const extra = [...autoLine(s), ...teaser(s)];
  if (!labUnlocked(s)) extra.push(paint(C.dim, `   Laboratório aparece após ${LAB.unlockAt} kWh produzidos.`));
  let room = height - 1 - panel.length - rows.length;
  const shownExtra = room >= extra.length ? extra : [];
  room -= shownExtra.length;
  const plant = room >= 1 ? [plantRow(s, width)] : [];
  room -= plant.length;
  const scene = room >= 7 ? windScene(s.owned.wind, ctx.now, power(s)) : [];
  const listRoom = height - 1 - panel.length - shownExtra.length - plant.length - scene.length;
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
  if (!genUnlocked(g, s)) return ctx.say(`${g.name} ainda está bloqueado (pesquisa).`, 'err');
  const before = s.owned[g.id];
  const n = buyGenBulk(s, g.id, amount);
  if (!n) return ctx.say(`Sem dinheiro para ${bulkLabel(amount)} ${g.name} ($${fmt(genBulk(s, g, amount).cost)}).`, 'err');
  ctx.say(`Comprou ${plural(n, g.name)}!`, 'ok');
  // Um lote grande pode cruzar mais de um marco de uma vez.
  for (const m of MILESTONES) {
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
  const list = items(ctx.state);
  const ui = ctx.ui;
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(list.length - 1, (ui.sel ?? 0) + 1); return true; }
  if (k === 'enter') { clampSel(ui, list.length); buy(ctx, list[ui.sel]); return true; }
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
  const g = GENERATORS.find((x) => x.key === k);
  if (g) { buy(ctx, { gen: g }); return true; }
  return false;
}
