// Página longa com rolagem: cada linha compara esta partida com todas as partidas.
import { GENERATORS } from '../../data/generators.js';
import { EVENTS } from '../../data/events.js';
import { HOT_GENERATORS } from '../../core/heat.js';
import { C, paint } from '../theme.js';
import { fmt, fmtDuration } from '../format.js';

export const help = '↑↓ rolar  PgUp/PgDn página  Home/End  espaço manivela  Tab abas  M menu  Q sair';

const LABEL_W = 36;
const COL_W = 20;

const money = (x) => `$${fmt(x)}`;
const kwh = (x) => `${fmt(x)} kWh`;
const int = (x) => (x < 1e5 ? String(Math.round(x)) : fmt(x));
const time = (x) => (x === null ? '—' : fmtDuration(x));
const secs = (x) => (x === null ? '—' : `${x.toFixed(1)} s`);
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

// Referências das curiosidades: consumo médio de uma casa brasileira por mês, e os
// 1,21 gigawatts do DeLorean (1 h de jogo = 1 s real, então 1,21 GW por 1 h).
const HOUSE_KWH_MONTH = 160;
const DELOREAN_KWH = 1.21e6;

function rows(s) {
  const R = s.stats;
  const T = s.career;
  const both = (label, f, key) => ({ label, run: f(R[key]), all: f(T[key]) });
  const calc = (label, f, g) => ({ label, run: f(g(R)), all: f(g(T)) });
  const careerOnly = (label, value) => ({ label, run: '—', all: value });
  const crisesTotal = (x) => x.crises.won + x.crises.lost + x.crises.crew + x.crises.timeout;
  const out = [
    { section: 'Geral' },
    both('Tempo jogado', time, 'playTime'),
    both('Tempo offline contado', time, 'offlineTime'),
    careerOnly('Partidas (ascensões + atual)', int(s.legacy.ascensions + 1)),
    calc('Eventos vistos', int, (x) => Object.values(x.events).reduce((a, b) => a + b, 0)),

    { section: 'Economia' },
    both('Dinheiro ganho', money, 'moneyEarned'),
    both('Dinheiro gasto', money, 'moneySpent'),
    both('  rendido pela manivela', money, 'crankMoney'),
    both('  custo de operação pago', money, 'upkeepPaid'),
    both('  pago às equipes de crise', money, 'crewPaid'),
    calc('Renda média', (x) => `${money(x)}/s`, (x) => (x.playTime ? x.moneyEarned / x.playTime : 0)),
    both('Energia produzida', kwh, 'energy'),
    both('  vendida com desconto (rede cheia)', kwh, 'excessEnergy'),
    both('  gerada na manivela', kwh, 'crankEnergy'),
    both('Pesquisa gerada', (x) => `${fmt(x)} PP`, 'rpEarned'),
    both('Pesquisa gasta', (x) => `${fmt(x)} PP`, 'rpSpent'),

    { section: 'Recordes' },
    both('Maior produção', (x) => `${fmt(x)} kW`, 'peakKw'),
    both('Maior renda', (x) => `${money(x)}/s`, 'peakIncome'),
    both('Maior preço do kWh', (x) => `$${x.toFixed(2)}`, 'peakPrice'),
    both('Maior saldo', money, 'peakMoney'),
    both('Giros da manivela em 1 s', int, 'crankBurst'),

    { section: 'Ações' },
    both('Giros da manivela', int, 'cranks'),
    calc('  energia média por giro', kwh, (x) => (x.cranks ? x.crankEnergy / x.cranks : 0)),
    both('Compras de geradores', int, 'purchases'),
    both('  em lote (mais de 1)', int, 'bulkPurchases'),
    both('Unidades da auto-compra', int, 'autoBought'),
    both('Laboratórios construídos', int, 'labsBought'),
    both('Upgrades', int, 'upgrades'),
    both('Marcos atingidos', int, 'milestones'),
    both('Pesquisas concluídas', int, 'techs'),
    both('Resfriamentos instalados', int, 'cooling'),
    both('Transformadores', int, 'transformers'),

    { section: 'Fontes' },
  ];
  for (const g of GENERATORS) {
    if (!T.bought[g.id] && !T.produced[g.id]) continue;
    out.push(calc(`${g.short}: unidades compradas`, int, (x) => x.bought[g.id]));
    out.push(calc(`  energia (parte do total)`, (v) => v, (x) => `${fmt(x.produced[g.id])} kWh ${pct(x.produced[g.id], x.energy)}`));
    if (HOT_GENERATORS.includes(g)) out.push(calc('  desligamentos por calor', int, (x) => x.shutdowns[g.id]));
  }
  if (out.at(-1).section) out.push({ label: paint(C.dim, 'nenhuma usina ainda'), run: '', all: '' });

  out.push({ section: 'Eventos' });
  for (const e of EVENTS) {
    const label = e.id === 'heatwave_crisis' ? `${e.name} (crise)` : e.crisis ? `${e.name} (crise)` : e.name;
    out.push(calc(label, int, (x) => x.events[e.id]));
  }

  out.push(
    { section: 'Crises' },
    calc('Vencidas por você', int, (x) => x.crises.won),
    calc('Perdidas', int, (x) => x.crises.lost),
    calc('Equipe chamada', int, (x) => x.crises.crew),
    calc('Ignoradas (equipe automática)', int, (x) => x.crises.timeout),
    calc('Taxa de vitória', (v) => v, (x) => pct(x.crises.won, crisesTotal(x))),
    both('Sequência de vitórias atual', int, 'streak'),
    both('Melhor sequência', int, 'bestStreak'),
    calc('Melhor tempo: barra de timing', secs, (x) => x.bestWin.timing),
    calc('Melhor tempo: válvulas', secs, (x) => x.bestWin.mash),
    calc('Melhor tempo: sequência de setas', secs, (x) => x.bestWin.sequence),

    { section: 'Legado' },
    careerOnly('Ascensões', int(s.legacy.ascensions)),
    careerOnly('Pontos de legado recebidos', int(s.legacy.earned)),
    careerOnly('Maior ganho numa ascensão', int(T.bestGain)),
    careerOnly('Partida mais rápida até ascender', time(T.fastestRun)),
    careerOnly('Dinheiro ganho (base do Legado)', money(s.legacy.lifetime + s.earned)),

    { section: 'Curiosidades' },
    calc('Casas abastecidas por um mês', int, (x) => Math.floor(x.energy / HOUSE_KWH_MONTH)),
    calc('Viagens de DeLorean (1,21 GW)', int, (x) => Math.floor(x.energy / DELOREAN_KWH)),
  );
  return out;
}

const cut = (str, w) => ([...str].length > w ? [...str].slice(0, w - 1).join('') + '…' : str);

function line(r) {
  if (r.section) return ' ' + paint(C.bold + C.cyan, r.section);
  return '   ' + cut(r.label, LABEL_W - 2).padEnd(LABEL_W - 2) + paint(C.green, cut(r.run, COL_W).padStart(COL_W)) + '  ' +
    paint(C.yellow, cut(r.all, COL_W).padStart(COL_W));
}

export function render(ctx, height) {
  const all = rows(ctx.state).map(line);
  const view = height - 2;
  const max = Math.max(0, all.length - view);
  const top = (ctx.ui.scroll = Math.max(0, Math.min(ctx.ui.scroll ?? 0, max)));
  const head = '   ' + paint(C.bold, 'Estatísticas'.padEnd(LABEL_W - 2)) + paint(C.bold + C.green, 'Esta partida'.padStart(COL_W)) +
    '  ' + paint(C.bold + C.yellow, 'Todas'.padStart(COL_W));
  const where = max ? paint(C.dim, `   linhas ${top + 1}–${Math.min(all.length, top + view)} de ${all.length}  (↑↓ rola)`) : '';
  return [head, ...all.slice(top, top + view), where];
}

export function key(ctx, k) {
  const ui = ctx.ui;
  const step = { up: -1, down: 1, pageup: -10, pagedown: 10, home: -Infinity, end: Infinity }[k];
  if (step === undefined) return false;
  ui.scroll = Math.max(0, (ui.scroll ?? 0) + step);
  if (!Number.isFinite(ui.scroll)) ui.scroll = 1e9; // render limita ao fim
  return true;
}
