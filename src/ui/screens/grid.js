// Aba Rede: quatro visões da mesma rede, alternadas com V.
//   mapa    matriz de células (uma por usina) colorida por estado
//   fluxo   fontes → rede → mercado, com setas animadas proporcionais à potência
//   gráfico histórico dos últimos 60 s (kW e $/s) + participação de cada fonte
//   calor   calor por reator, eficiência, desligamentos e resfriamento
// Também é onde se compra capacidade com dinheiro (T) e resfriamento (C).
import { GENERATORS } from '../../data/generators.js';
import { GRID } from '../../data/grid.js';
import { HEAT } from '../../data/heat.js';
import {
  power, genPower, genEnv, capacity, sales, gridLoad, price, income, upkeep, transformerCost,
  genModMult, excessRate, crewCut,
} from '../../core/engine.js';
import {
  HOT_GENERATORS, heatLevel, heatTarget, efficiency, isShutdown, shutdownLeft, coolingLevel, nextCooling,
} from '../../core/heat.js';
import { buyCooling, buyTransformer, expandRegion, expandCost, canExpand, cleanCost, fixCost, payClean, payFix, handClean, toggleCrew } from '../../core/actions.js';
import { HISTORY_LEN } from '../../core/stats.js';
import { COOLING } from '../../data/heat.js';
import { C, paint, glyphs, GEN_COLOR } from '../theme.js';
import { forecast, STEP } from '../../core/forecast.js';
import { REGION_RULES } from '../../data/regions.js';
import { nextRegion, regionName } from '../../core/regions.js';
import { WEAR, WEAR_BY_GEN } from '../../data/wear.js';
import { wearLevel, brokenCount, efficiency as wearEfficiency } from '../../core/wear.js';
import { rand as marketRand } from '../../core/market.js';
import { fmt, fmtPct, bar, sparkline, padVisible } from '../format.js';

const VIEWS = [
  { id: 'map', label: 'Mapa' },
  { id: 'flow', label: 'Fluxo' },
  { id: 'chart', label: 'Gráfico' },
  { id: 'heat', label: 'Calor' },
  { id: 'forecast', label: 'Previsão' },
  { id: 'wear', label: 'Manutenção' },
];
const WEAR_VIEW = VIEWS.findIndex((v) => v.id === 'wear');
const HEAT_VIEW = VIEWS.findIndex((v) => v.id === 'heat');

export const help = (ctx) => {
  if (ctx.ui.hand) return 'setas na ordem para consertar  J cancela  M menu  Q sair';
  return VIEWS[ctx.ui.view ?? 0].id === 'wear'
    ? 'V visão  ↑↓ fonte  F paga  J faz à mão  A equipe  espaço gira  M menu  Q sair'
    : 'V visão  N expandir  T transformador  ↑↓ C resfriar  espaço gira  Q sair';
};

const owned = (s) => GENERATORS.filter((g) => s.owned[g.id] > 0);
const loadColor = (load) => (load > 1 ? C.red + C.bold : load > 0.85 ? C.yellow : C.green);
const heatColor = (h) => (h >= HEAT.shutdownAt ? C.red + C.bold : h > HEAT.warnAt ? C.red : h > 0.6 ? C.yellow : C.green);

function header(s, view) {
  const tabs = VIEWS.map((v) => (v.id === view ? paint(C.inverse + C.bold, ` ${v.label} `) : ` ${v.label} `)).join('');
  const load = gridLoad(s);
  const next = nextRegion(s);
  let expand;
  if (!next) expand = paint(C.green, 'última região do capítulo');
  else if (!canExpand(s)) expand = paint(C.dim, `[N] ${next.name} pede ${fmt(next.need)} kW de produção`);
  else expand = paint(s.money >= expandCost(s) ? C.yellow + C.bold : C.yellow, `[N] expandir para ${next.name}: $${fmt(expandCost(s))}`);
  return [
    '  ' + tabs + paint(C.dim, '   (V alterna)'),
    '  ' + paint(C.bold, regionName(s)) + ` · capacidade ${paint(C.bold, fmt(capacity(s)) + ' kW')} · uso ` + paint(loadColor(load), fmtPct(load)) +
      paint(C.dim, ' · ') + expand,
    '  ' + paint(C.dim, `transformadores ${s.transformers}`) +
      paint(s.money >= transformerCost(s) ? C.yellow : C.dim,
        ` · [T] +${Math.round((GRID.transformer.capacityMult - 1) * 100)}% por $${fmt(transformerCost(s))}`),
  ];
}

// ---------- 1. mapa ----------
// 12×6 células. Com poucas usinas, uma célula = uma usina; com muitas, as células são
// divididas entre as fontes proporcionalmente (toda fonte com usina ganha ao menos 1).
const MAP_W = 12;
const MAP_H = 6;

export function allocateCells(counts, total = MAP_W * MAP_H) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const sum = entries.reduce((a, [, n]) => a + n, 0);
  if (sum <= total) return Object.fromEntries(entries);
  // Maiores restos: cada fonte recebe floor(proporção), as sobras vão para os maiores restos.
  const base = entries.map(([id, n]) => {
    const exact = (n / sum) * total;
    return { id, cells: Math.max(1, Math.floor(exact)), rest: exact - Math.floor(exact) };
  });
  let left = total - base.reduce((a, b) => a + b.cells, 0);
  for (const b of [...base].sort((x, y) => y.rest - x.rest)) {
    if (left <= 0) break;
    b.cells++;
    left--;
  }
  // O mínimo de 1 célula pode estourar o total: tira das maiores.
  while (left < 0) {
    const big = base.reduce((a, b) => (b.cells > a.cells ? b : a));
    big.cells--;
    left++;
  }
  return Object.fromEntries(base.map((b) => [b.id, b.cells]));
}

function cellOf(s, g) {
  const sh = glyphs().shade;
  if (isShutdown(s, g)) return { ch: glyphs().off, color: C.red + C.bold };
  if (heatLevel(s, g) > HEAT.warnAt) return { ch: sh[3], color: C.red };
  const f = genEnv(s, g);
  if (f < 0.35) return { ch: sh[0], color: C.dim + GEN_COLOR[g.id] };
  return { ch: f < 1 ? sh[1] : sh[2], color: GEN_COLOR[g.id] };
}

function mapView(s, height) {
  const cells = allocateCells(Object.fromEntries(owned(s).map((g) => [g.id, s.owned[g.id]])));
  const flat = [];
  for (const g of owned(s)) for (let i = 0; i < (cells[g.id] ?? 0); i++) flat.push(cellOf(s, g));
  // Rede saturada: as últimas células (a fatia excedente) ficam em vermelho cheio.
  const load = gridLoad(s);
  if (load > 1) {
    const excess = Math.round(flat.length * (1 - 1 / load));
    for (let i = flat.length - excess; i < flat.length; i++) flat[i] = { ch: glyphs().shade[3], color: C.red + C.bold };
  }
  const grid = [];
  for (let r = 0; r < MAP_H; r++) {
    let line = '';
    for (let c = 0; c < MAP_W; c++) {
      const cell = flat[r * MAP_W + c];
      line += cell ? paint(cell.color, cell.ch + cell.ch) + ' ' : paint(C.dim, glyphs().empty + ' ') + ' ';
    }
    grid.push(line);
  }
  const sh = glyphs().shade;
  const legend = [
    paint(C.dim, `${sh[0]} ociosa  ${sh[1]} normal  ${sh[2]} forte`),
    paint(C.dim, `${sh[3]} sobrecarga  ${glyphs().off} desligada`),
    '',
    ...owned(s).map((g) => paint(GEN_COLOR[g.id], sh[2]) + ` ${g.short.padEnd(13)} x${s.owned[g.id]}`),
  ];
  const rows = Math.max(grid.length, legend.length);
  const out = [];
  for (let i = 0; i < Math.min(rows, height); i++) out.push('  ' + padVisible(grid[i] ?? '', MAP_W * 3 + 2) + (legend[i] ?? ''));
  if (!owned(s).length) out.splice(0, out.length, '', paint(C.dim, '   Nenhuma usina ainda — compre na aba Geradores.'));
  if (load > 1 && out.length < height) out.push('', paint(C.red + C.bold, '   REDE SATURADA') + paint(C.dim, ` — excedente vendido a ${Math.round(excessRate(s) * 100)}% do preço`));
  return out;
}

// ---------- 2. fluxo ----------
// Seta animada de `width` colunas: grupos de 1 a 3 ">" (pela participação da fonte)
// andando para a direita conforme o tempo passa.
export function flowArrow(share, now, width = 8) {
  const g = glyphs();
  if (!(share > 0)) return paint(C.dim, g.empty.repeat(width));
  const n = share >= 0.4 ? 3 : share >= 0.1 ? 2 : 1;
  const period = 4;
  const phase = Math.floor(now / 150) % period; // ~6.7 passos por segundo
  let out = '';
  for (let x = 0; x < width; x++) out += ((x - phase) % period + period) % period < n ? '>' : g.box.h;
  return out;
}

function box(lines, width, color = '') {
  const b = glyphs().box;
  return [
    paint(color, b.tl + b.h.repeat(width - 2) + b.tr),
    ...lines.map((l) => paint(color, b.v) + padVisible(' ' + l, width - 2) + paint(color, b.v)),
    paint(color, b.bl + b.h.repeat(width - 2) + b.br),
  ];
}

function flowView(s, height, now) {
  const total = power(s);
  const srcs = owned(s);
  if (!srcs.length) return ['', paint(C.dim, '   Nenhuma usina ainda — compre na aba Geradores.')];
  const load = gridLoad(s);
  const sl = sales(s, total);
  const left = srcs.slice(0, height - 1).map((g) => {
    const kw = genPower(s, g);
    return `  ${paint(GEN_COLOR[g.id], g.short.padEnd(13))}${(fmt(kw) + ' kW').padStart(11)} ${paint(GEN_COLOR[g.id], flowArrow(kw / (total || 1), now))}`;
  });
  const grid = box([
    paint(C.bold, 'REDE'),
    `${fmt(total)} kW`,
    paint(C.dim, `de ${fmt(capacity(s))}`),
    paint(loadColor(load), bar(Math.min(load, 1), 7) + ` ${fmtPct(load)}`),
  ], 16, loadColor(load));
  const market = box([
    paint(C.bold, 'MERCADO'),
    `$${price(s).toFixed(2)}/kWh`,
    paint(C.green, `+$${fmt(sl.perSecond)}/s`),
    sl.excess > 0 ? paint(C.red, `exc. ${fmt(sl.excess)} kW`) : paint(C.dim, 'sem excedente'),
  ], 18);
  const mid = 2; // linha das caixas por onde passam as setas
  const right = grid.map((l, i) => {
    let link = '      ';
    if (i === mid) link = ' ' + paint(C.green, flowArrow(sl.full / (total || 1), now, 4)) + ' ';
    if (i === mid + 1 && sl.excess > 0) link = ' ' + paint(C.red, flowArrow(0.05, now, 4)) + ' ';
    return l + link + market[i];
  });
  const rows = Math.max(left.length, right.length);
  const off = Math.max(0, Math.floor((left.length - right.length) / 2));
  const b = glyphs().box;
  const out = [];
  for (let i = 0; i < rows; i++) {
    const join = left.length > 1 ? (i === 0 ? b.tr : i === left.length - 1 ? b.br : i < left.length ? b.tee : ' ') : b.h;
    const l = i < left.length ? padVisible(left[i] + paint(C.dim, join), 37) : ' '.repeat(37);
    const r = right[i - off] ?? '';
    out.push(l + (i - off === mid ? paint(C.dim, '>') : ' ') + r);
  }
  if (out.length < height) out.push('', paint(C.dim, `   upkeep -$${fmt(upkeep(s))}/s · renda líquida $${fmt(income(s))}/s`));
  return out;
}

// ---------- 3. gráfico ----------
function chartView(s, height, history) {
  const w = HISTORY_LEN;
  const series = (label, vals, color, unit) => {
    const last = vals.at(-1) ?? 0;
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 0;
    return [
      `  ${paint(C.bold, label)} ${paint(C.dim, `últimos ${vals.length} s · mín ${fmt(lo)} · máx ${fmt(hi)}`)}  ${paint(color, fmt(last) + unit)}`,
      '  ' + paint(color, sparkline(vals, w)),
    ];
  };
  const out = [
    ...series('Produção', history.kw, C.cyan, ' kW'),
    ...series('Renda', history.income, C.green, ' $/s'),
    '',
    `  ${paint(C.bold, 'Participação agora')}`,
  ];
  const total = power(s) || 1;
  const parts = owned(s).map((g) => ({ g, kw: genPower(s, g) })).sort((a, b) => b.kw - a.kw);
  for (const { g, kw } of parts.slice(0, Math.max(0, height - out.length))) {
    const share = kw / total;
    out.push(`  ${g.short.padEnd(13)} ${paint(GEN_COLOR[g.id], bar(share, 30))} ${String(Math.round(share * 100)).padStart(3)}%  ${fmt(kw)} kW`);
  }
  if (!parts.length) out.push(paint(C.dim, '   Nenhuma usina ainda.'));
  return out;
}

// ---------- 5. previsão ----------
const FORECAST_COLOR = { wind: C.cyan, sun: C.yellow, tide: C.blue, vacuum: C.mag, price: C.green };
function forecastView(s, height) {
  const { err, series } = forecast(s);
  const out = [
    `  ${paint(C.bold, 'Próximas 24 h de jogo')} ${paint(C.dim, `(24 s) · erro até ±${Math.round(err * 100)}% no fim · surtos não se preveem`)}`,
    '',
  ];
  for (const { id, label, values } of series) {
    if (out.length + 2 > height) break;
    const now = values[0];
    const hi = Math.max(...values);
    const peak = Math.round(values.indexOf(hi) * STEP);
    const unit = id === 'price' ? `$${now.toFixed(2)}` : `${now.toFixed(2)}x`;
    const when = peak === 0 ? 'no máximo' : `pico em ${peak}h`;
    out.push(`  ${paint(C.bold, label.padEnd(6))} ${paint(FORECAST_COLOR[id], sparkline(values, values.length))}  ${paint(C.dim, `${unit} → ${when}`)}`);
  }
  if (out.length <= 3) out.push(paint(C.dim, '   Compre eólicas, solares ou maremotrizes para ver o clima delas.'));
  return out;
}

// ---------- 6. manutenção ----------
const wearColor = (w) => (w > 0.66 ? C.red : w > 0.33 ? C.yellow : C.green);
function wearView(s, height, ui) {
  const list = owned(s);
  const crew = s.wear.crew
    ? paint(C.green, 'equipe contratada') + paint(C.dim, ` (-${Math.round(crewCut(s) * 100)}% da receita, desgaste até ${Math.round(WEAR.crewCap * 100)}%)  [A] dispensa`)
    : paint(C.dim, `sem equipe  ·  [A] contrata: -${Math.round(WEAR.crewShare * 100)}% da receita, cuida de tudo`);
  const out = ['  ' + crew, ''];
  if (!list.length) return [...out, paint(C.dim, '   Nenhuma usina ainda.')];
  ui.wearSel = Math.max(0, Math.min(ui.wearSel ?? 0, list.length - 1));
  const room = Math.max(1, height - out.length - 3);
  const top = Math.max(0, Math.min(ui.wearSel - Math.floor(room / 2), list.length - room));
  list.slice(top, top + room).forEach((g, k) => {
    const idx = top + k;
    const w = wearLevel(s, g);
    const broken = brokenCount(s, g);
    const state = broken ? paint(C.red + C.bold, `${broken} parada${broken > 1 ? 's' : ''}`) : paint(C.dim, WEAR_BY_GEN[g.id].what);
    const row = `${idx === ui.wearSel ? '›' : ' '} ${g.short.padEnd(12)} ${paint(wearColor(w), bar(w, 10))} ` +
      `${paint(C.dim, 'eficiência')} ${String(Math.round(wearEfficiency(w) * 100)).padStart(3)}%  ${state}`;
    out.push(' ' + (idx === ui.wearSel ? paint(C.bold, row) : row));
  });
  const g = list[ui.wearSel];
  const cost = cleanCost(s, g) + (brokenCount(s, g) ? fixCost(s, g) : 0);
  out.push('');
  if (ui.hand) {
    const seq = ui.hand.seq.map((d, i) => (i < ui.hand.idx ? paint(C.green, glyphs().arrow[d]) : i === ui.hand.idx ? paint(C.bold + C.yellow + C.inverse, glyphs().arrow[d]) : paint(C.dim, glyphs().arrow[d])));
    out.push(`  ${paint(C.bold, `Consertando ${g.name} à mão:`)} ${seq.join(' ')}` + paint(C.dim, `   erros ${ui.hand.errors}/2`));
  } else if (cost > 0) {
    out.push(`  ${paint(C.yellow, `[F] pagar $${fmt(cost)}`)}${paint(C.dim, '  ou  ')}${paint(C.cyan, '[J] fazer à mão (grátis)')}` +
      paint(C.dim, `  ·  ${g.name}`));
  } else {
    out.push(paint(C.dim, `  ${g.name} em dia.`));
  }
  return out;
}

// ---------- 4. calor ----------
const hotOwned = (s) => HOT_GENERATORS.filter((g) => s.owned[g.id] > 0);

// Pequena variação determinística por reator (para o "mapa de calor" não ser uma
// faixa de cor única): mesma posição, mesmo desvio, sem RNG.
const jitter = (i) => 0.06 * Math.sin(i * 12.9898);

function heatView(s, height, now, ui) {
  const list = hotOwned(s);
  if (!list.length) {
    return ['', paint(C.dim, '   Nenhum reator ainda. Nuclear, Fusão e Antimatéria geram calor:'),
      paint(C.dim, `   acima de ${Math.round(HEAT.warnAt * 100)}% perdem eficiência; em 100% desligam por ${HEAT.shutdownSeconds} s.`)];
  }
  ui.heatSel = Math.max(0, Math.min(ui.heatSel ?? 0, list.length - 1));
  const out = [];
  const sh = glyphs().shade;
  list.forEach((g, idx) => {
    const sel = idx === ui.heatSel;
    const h = heatLevel(s, g);
    const off = isShutdown(s, g);
    // Desligado pisca (alterna negrito a cada ~0.4 s): chama atenção sem som.
    const blink = Math.floor(now / 400) % 2 === 0;
    const status = off ? paint(C.red + (blink ? C.bold : ''), `DESLIGADO ${Math.ceil(shutdownLeft(s, g))}s`)
      : h > HEAT.warnAt ? paint(C.yellow, `quente: eficiência ${Math.round(efficiency(h) * 100)}%`)
      : paint(C.green, 'estável');
    const target = heatTarget(s, g, genModMult(s, g, 'output'));
    out.push(`${sel ? ' ›' : '  '} ${paint(C.bold, g.name.padEnd(16))} x${String(s.owned[g.id]).padEnd(5)}` +
      paint(heatColor(h), bar(h, 16)) + ` ${String(Math.round(h * 100)).padStart(3)}%  ` + status);
    const n = Math.min(s.owned[g.id], 40);
    let cells = '';
    for (let i = 0; i < n; i++) {
      const hi = Math.max(0, h + jitter(i));
      cells += off ? paint(C.red + (blink ? C.bold : C.dim), glyphs().off)
        : paint(heatColor(hi), sh[Math.min(3, Math.floor(hi * 3.99))]);
    }
    out.push(`     ${cells}${s.owned[g.id] > n ? paint(C.dim, ` +${s.owned[g.id] - n}`) : ''}` +
      paint(C.dim, `  alvo ${fmtPct(target)}`));
    const c = nextCooling(s, g);
    const lvl = `${coolingLevel(s, g)}/${COOLING.levels.length}`;
    out.push(c
      ? '     ' + paint(sel && s.money >= c.cost ? C.yellow : C.dim, `resfriamento ${lvl} → ${sel ? '[C] ' : ''}${c.name} (calor ÷${COOLING.factor}) — $${fmt(c.cost)}`)
      : '     ' + paint(C.dim, `resfriamento ${lvl} ✓`));
  });
  if (out.length + 2 <= height) {
    out.push('', paint(C.dim, `   >${Math.round(HEAT.warnAt * 100)}% perde eficiência · 100% desliga ${HEAT.shutdownSeconds} s · mais produção = mais calor`));
  }
  return out;
}

export function render(ctx, height) {
  const ui = ctx.ui;
  const view = VIEWS[ui.view ?? 0].id;
  const s = ctx.state;
  const top = [...header(s, view), ''];
  const room = height - top.length;
  const body = view === 'map' ? mapView(s, room)
    : view === 'flow' ? flowView(s, room, ctx.anim)
    : view === 'chart' ? chartView(s, room, ctx.history)
    : view === 'forecast' ? forecastView(s, room)
    : view === 'wear' ? wearView(s, room, ui)
    : heatView(s, room, ctx.anim, ui);
  return [...top, ...body];
}

// Minijogo de manutenção à mão: as setas na ordem; 2 erros cancelam (sem custo).
function handKey(ctx, k) {
  const ui = ctx.ui;
  const h = ui.hand;
  if (k === 'j' || k === 'J') { ui.hand = null; ctx.say('Conserto à mão cancelado.', 'info', 2000); return true; }
  if (!['up', 'down', 'left', 'right'].includes(k)) return true; // nada mais vaza no meio do conserto
  if (k === h.seq[h.idx]) {
    if (++h.idx >= h.seq.length) {
      handClean(ctx.state, h.gen);
      ui.hand = null;
      ctx.say(`${GENERATORS.find((g) => g.id === h.gen).name} revisada à mão: novinha.`, 'ok');
    }
  } else if (++h.errors >= 2) {
    ui.hand = null;
    ctx.say('Errou a sequência: o conserto ficou para depois.', 'err');
  }
  return true;
}

const ARROWS = ['up', 'right', 'down', 'left'];

function wearKey(ctx, k) {
  const ui = ctx.ui;
  const s = ctx.state;
  const list = owned(s);
  const g = list[ui.wearSel ?? 0];
  if (k === 'up' || k === 'down') {
    ui.wearSel = Math.max(0, Math.min(list.length - 1, (ui.wearSel ?? 0) + (k === 'up' ? -1 : 1)));
    return true;
  }
  if (k === 'a' || k === 'A') {
    ctx.say(toggleCrew(s) ? 'Equipe de manutenção contratada.' : 'Equipe de manutenção dispensada.', 'info');
    return true;
  }
  if (!g) return false;
  if (k === 'f' || k === 'F') {
    const cost = cleanCost(s, g) + (brokenCount(s, g) ? fixCost(s, g) : 0);
    if (cost <= 0) ctx.say(`${g.name} já está em dia.`, 'info');
    else if (s.money < cost) ctx.say(`Faltam $${fmt(cost - s.money)} para a manutenção de ${g.name}.`, 'err');
    else {
      payClean(s, g.id);
      while (brokenCount(s, g) && payFix(s, g.id));
      ctx.say(`Manutenção de ${g.name} feita por $${fmt(cost)}.`, 'ok');
    }
    return true;
  }
  if (k === 'j' || k === 'J') {
    if (wearLevel(s, g) <= 0 && !brokenCount(s, g)) { ctx.say(`${g.name} já está em dia.`, 'info'); return true; }
    ui.hand = { gen: g.id, seq: Array.from({ length: WEAR.handArrows }, () => ARROWS[Math.floor(marketRand(s) * 4)]), idx: 0, errors: 0 };
    return true;
  }
  return false;
}

export function key(ctx, k) {
  const ui = ctx.ui;
  const s = ctx.state;
  if (ui.hand) return handKey(ctx, k);
  if (k === 'v' || k === 'V') { ui.view = ((ui.view ?? 0) + 1) % VIEWS.length; return true; }
  if (VIEWS[ui.view ?? 0].id === 'wear' && wearKey(ctx, k)) return true;
  if (k === 'n' || k === 'N') {
    const next = nextRegion(s);
    if (!next) ctx.say('Você já atende a última região deste capítulo.', 'info');
    else if (!canExpand(s)) ctx.say(`${next.name} pede ${fmt(next.need)} kW de produção para dar a concessão.`, 'info');
    else if (s.money < expandCost(s)) ctx.say(`Faltam $${fmt(expandCost(s) - s.money)} para a concessão de ${next.name}.`, 'err');
    else {
      expandRegion(s);
      ctx.say(`Concessão: agora você atende ${next.name}! Rede ${fmt(capacity(s))} kW, kWh +${Math.round(REGION_RULES.pricePerRegion * 100)}%.`, 'ok', 8000);
    }
    return true;
  }
  if (k === 't' || k === 'T') {
    const cost = transformerCost(s);
    if (buyTransformer(s)) ctx.say(`Transformador instalado: capacidade ${fmt(capacity(s))} kW.`, 'ok');
    else ctx.say(`Faltam $${fmt(cost - s.money)} para o transformador.`, 'err');
    return true;
  }
  const list = hotOwned(s);
  if (k === 'up' || k === 'down') {
    ui.view = HEAT_VIEW; // setas e C só fazem sentido na visão de calor: vai direto para ela
    ui.heatSel = Math.max(0, Math.min(list.length - 1, (ui.heatSel ?? 0) + (k === 'up' ? -1 : 1)));
    return true;
  }
  if (k === 'c' || k === 'C') {
    const g = list[ui.heatSel ?? 0];
    if (!g) { ctx.say('Nenhum reator para resfriar ainda.', 'info'); return true; }
    const c = nextCooling(s, g);
    if (!c) ctx.say(`${g.name}: resfriamento completo.`, 'info');
    else if (buyCooling(s, g.id)) ctx.say(`Resfriamento: ${c.name} (${g.name}).`, 'ok');
    else ctx.say(`Faltam $${fmt(c.cost - s.money)} para ${c.name}.`, 'err');
    ui.view = HEAT_VIEW;
    return true;
  }
  return false;
}
