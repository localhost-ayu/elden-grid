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
  genModMult, excessRate,
} from '../../core/engine.js';
import {
  HOT_GENERATORS, heatLevel, heatTarget, efficiency, isShutdown, shutdownLeft, coolingLevel, nextCooling,
} from '../../core/heat.js';
import { buyCooling, buyTransformer } from '../../core/actions.js';
import { HISTORY_LEN } from '../../core/stats.js';
import { COOLING } from '../../data/heat.js';
import { C, paint, glyphs, GEN_COLOR } from '../theme.js';
import { forecast, STEP } from '../../core/forecast.js';
import { fmt, fmtPct, bar, sparkline, padVisible } from '../format.js';

const VIEWS = [
  { id: 'map', label: 'Mapa' },
  { id: 'flow', label: 'Fluxo' },
  { id: 'chart', label: 'Gráfico' },
  { id: 'heat', label: 'Calor' },
  { id: 'forecast', label: 'Previsão' },
];

export const help = 'V muda visão  T transformador  ↑↓ C resfriar  espaço gira  M menu  Q sair';

const owned = (s) => GENERATORS.filter((g) => s.owned[g.id] > 0);
const loadColor = (load) => (load > 1 ? C.red + C.bold : load > 0.85 ? C.yellow : C.green);
const heatColor = (h) => (h >= HEAT.shutdownAt ? C.red + C.bold : h > HEAT.warnAt ? C.red : h > 0.6 ? C.yellow : C.green);

function header(s, view) {
  const tabs = VIEWS.map((v) => (v.id === view ? paint(C.inverse + C.bold, ` ${v.label} `) : ` ${v.label} `)).join('');
  const load = gridLoad(s);
  return [
    '  ' + tabs + paint(C.dim, '   (V alterna)'),
    '  ' + `Capacidade ${paint(C.bold, fmt(capacity(s)) + ' kW')} · uso ` + paint(loadColor(load), fmtPct(load)) +
      paint(C.dim, ` · transformadores ${s.transformers}`) +
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
    : heatView(s, room, ctx.anim, ui);
  return [...top, ...body];
}

export function key(ctx, k) {
  const ui = ctx.ui;
  const s = ctx.state;
  if (k === 'v' || k === 'V') { ui.view = ((ui.view ?? 0) + 1) % VIEWS.length; return true; }
  if (k === 't' || k === 'T') {
    const cost = transformerCost(s);
    if (buyTransformer(s)) ctx.say(`Transformador instalado: capacidade ${fmt(capacity(s))} kW.`, 'ok');
    else ctx.say(`Faltam $${fmt(cost - s.money)} para o transformador.`, 'err');
    return true;
  }
  const list = hotOwned(s);
  if (k === 'up' || k === 'down') {
    ui.view = 3; // setas e C só fazem sentido na visão de calor: vai direto para ela
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
    ui.view = 3;
    return true;
  }
  return false;
}
