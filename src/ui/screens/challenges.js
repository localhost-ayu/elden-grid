// Tela de Desafios (tela cheia, pelo menu): escolhe desafio e nível e mostra a partida em
// andamento no slot D. ↑↓ desafio, ←→ nível (até o próximo a completar), Enter joga,
// C continua a partida do slot D.
import { CHALLENGES, GOALS, TIER_MULT } from '../../data/challenges.js';
import { GENERATORS } from '../../data/generators.js';
import { challengeTier, MAX_TIER } from '../../core/profile.js';
import { challengeDef, dailyChallenges, dailyCode } from '../../core/challenges.js';
import { totalTiers } from '../../core/rewards.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt, bar } from '../format.js';

export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export const confirmHelp = 'S confirmar  N/Esc cancelar';
export const help = (ctx) => (ctx.ui.confirm
  ? confirmHelp
  : `↑↓ desafio  ←→ nível  Enter jogar${ctx.challengeRun ? '  C continuar' : ''}  Esc voltar  Q sair`);

const genName = (id) => GENERATORS.find((g) => g.id === id)?.short.toLowerCase() ?? id;

// A regra do nível em uma linha (o que muda em relação a uma partida normal).
export function describeRule(r) {
  const parts = [];
  if (r.eventGap) parts.push(`eventos x${(1 / r.eventGap).toFixed(1)}`);
  const level = r.crisisLevel ? ` nível ${r.crisisLevel}` : '';
  if (r.crisisWeight) parts.push(`crises x${r.crisisWeight}${level}`);
  else if (level) parts.push(`crises${level}`);
  if (r.disabled) {
    const names = [...r.disabled.map(genName), ...(r.noCrank ? ['manivela'] : [])];
    parts.push(`sem ${names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : names[0]}`);
  }
  if (r.capacityExp) parts.push(`Linhas de Alta Tensão rendem x${(20 ** r.capacityExp).toFixed(1)} em vez de x20`);
  if (r.priceHalfLife) parts.push(`preço cai à metade a cada ${Math.round(r.priceHalfLife / 60)} min, até ${Math.round(r.priceFloor * 100)}%`);
  if (r.upkeep) parts.push(`operação x${r.upkeep}`);
  if (r.cost) parts.push(`construir ${Object.keys(r.cost).map(genName).join('/')} x${Object.values(r.cost)[0]}`);
  if (r.noReward) parts.push('sem bônus por vitória');
  if (r.output) parts.push(`usinas a combustível x${Object.values(r.output)[0]}`);
  if (r.heat) parts.push(`calor x${r.heat}`);
  return parts.join(', ');
}

// Vantagem temática: valor de n níveis ("+30 s", "-50%") e onde ela vale.
const REWARD_VALUE = {
  crisisTime: (v) => `+${v} s`,
  solar: (v) => `+${Math.round(v * 100)}%`,
  capacity: (v) => `+${Math.round(v * 100)}%`,
  price: (v) => `+${Math.round(v * 100)}%`,
  upkeep: (v) => `-${Math.round(v * 100)}%`,
};
const REWARD_LABEL = {
  crisisTime: 'de prazo nas crises', solar: 'na solar (já pesquisada)', capacity: 'na capacidade da rede',
  price: 'no preço do kWh', upkeep: 'no custo de operação',
};
const rewardValue = (c, n) => REWARD_VALUE[c.reward.type](+(c.reward.per * n).toFixed(2));
export const rewardText = (c, n) => `${rewardValue(c, n)} ${REWARD_LABEL[c.reward.type]}`;
// Tempo curto para caber os 5 recordes numa linha: "41min", "9h30".
export function shortTime(sec) {
  const min = Math.round(sec / 60);
  return min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}
const times = (m) => `x${m < 100 ? m.toFixed(2) : fmt(m)}`;

const pips = (n) => glyphs().dot.repeat(n) + glyphs().dotEmpty.repeat(MAX_TIER - n);
const maxPlayable = (ctx, c) => Math.min(MAX_TIER, challengeTier(ctx.profile, c.id) + 1);

// Linha extra depois dos desafios: a semente do dia.
const DAILY = CHALLENGES.length;
const dayLabel = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const runName = (run) => (run.daily
  ? `Semente do dia ${dayLabel(run.daily)}`
  : `${challengeDef(run.challenge)?.name ?? run.challenge} ${ROMAN[run.tier - 1]}`);

function clamp(ctx) {
  const ui = ctx.ui;
  ui.sel = Math.max(0, Math.min(ui.sel ?? 0, DAILY));
  if (ui.sel === DAILY) return { c: null, tier: 1 };
  const c = CHALLENGES[ui.sel];
  ui.tier ??= {};
  ui.tier[c.id] = Math.max(1, Math.min(ui.tier[c.id] ?? maxPlayable(ctx, c), maxPlayable(ctx, c)));
  return { c, tier: ui.tier[c.id] };
}

function runLine(ctx) {
  const info = ctx.challengeRun;
  if (!info) return paint(C.dim, '   Slot D vazio: escolha um desafio e aperte Enter.');
  const { run, earned } = info;
  const goal = run.daily ? GOALS[0] : GOALS[run.tier - 1];
  if (run.done) return '   ' + paint(C.green, `Slot D: ${runName(run)} concluído ✓`) + paint(C.dim, '  (C volta a ele)');
  return '   ' + paint(C.bold, `Slot D: ${runName(run)}`) + paint(C.dim, `  ${bar(earned / goal, 12)} $${fmt(earned)} / $${fmt(goal)}`) +
    paint(C.yellow, '  C continua');
}

function challengeInfo(ctx, c, tier) {
  const best = ctx.profile.challenges[c.id]?.best ?? {};
  const records = Object.entries(best).map(([t, sec]) => `${ROMAN[t - 1]} ${shortTime(sec)}`).join('  ·  ');
  const done = challengeTier(ctx.profile, c.id);
  return [
    '   ' + paint(C.bold, `${c.name} — nível `) + paint(C.yellow, `‹ ${ROMAN[tier - 1]} ›`) +
      paint(C.dim, `   meta: ganhar $${fmt(GOALS[tier - 1])} na partida`),
    paint(C.dim, `   regra: ${describeRule(c.rules[tier - 1])}`),
    paint(C.dim, `   recordes: ${records || 'nenhum ainda'}`),
    '   ' + paint(C.cyan, `${c.reward.name}: `) + paint(C.dim, `${rewardText(c, 1)} por nível`) +
      (done ? paint(C.cyan, ` (agora ${rewardValue(c, done)})`) : ''),
  ];
}

// A semente de hoje: regra sorteada, recorde de hoje e o código para os amigos.
function dailyInfo(ctx) {
  const date = ctx.today;
  const names = dailyChallenges(date).map((id) => challengeDef(id).name).join(' + ');
  const rules = dailyChallenges(date).map((id) => paint(C.dim, `   ${challengeDef(id).name}: ${describeRule(challengeDef(id).rules[0])}`));
  const best = ctx.profile.daily[date];
  return [
    '   ' + paint(C.bold, `Semente do dia ${dayLabel(date)}: ${names}`) + paint(C.dim, `   meta: $${fmt(GOALS[0])}`),
    ...rules,
    paint(C.dim, '   mesma partida para todo mundo hoje; conta só o tempo com o jogo aberto'),
    best
      ? '   ' + paint(C.cyan, `recorde de hoje: ${shortTime(best)}  ·  código: ${dailyCode(date, best)}`)
      : paint(C.dim, '   recorde de hoje: nenhum ainda (o código aparece ao terminar)'),
  ];
}

export function render(ctx, height = Infinity) {
  const ui = ctx.ui;
  const { c, tier } = clamp(ctx);
  const lines = [
    '   ' + paint(C.bold, 'Desafios') + paint(C.dim, '  ·  do zero, sem legado, no slot D  ·  os saves 1–3 não são tocados'),
    '   ' + paint(C.yellow, `Recompensas nos slots 1–3: produção ${times(TIER_MULT ** totalTiers(ctx.profile))}`) +
      paint(C.dim, `  (${totalTiers(ctx.profile)}/${CHALLENGES.length * MAX_TIER} níveis; cada um vale x${TIER_MULT})`),
    '',
  ];
  CHALLENGES.forEach((ch, i) => {
    const selected = i === ui.sel;
    const done = challengeTier(ctx.profile, ch.id);
    const row = `${selected ? '›' : ' '} ${ch.icon} ${ch.name.padEnd(18)} ${pips(done)}   ${ch.desc}`;
    lines.push(' ' + paint(selected ? C.bold + C.yellow : done === MAX_TIER ? C.green : '', row));
  });
  const today = ctx.profile.daily[ctx.today];
  const dailyRow = `${ui.sel === DAILY ? '›' : ' '} ${glyphs().legacy} ${'Semente do dia'.padEnd(18)} ${today ? `${shortTime(today)}`.padEnd(5) : '     '}   mesma partida para todos, hoje (${dayLabel(ctx.today)})`;
  lines.push(' ' + paint(ui.sel === DAILY ? C.bold + C.yellow : C.cyan, dailyRow));
  lines.push('', ...(c ? challengeInfo(ctx, c, tier) : dailyInfo(ctx)), '', runLine(ctx));
  if (ui.confirm) lines.push('', '   ' + paint(C.yellow + C.bold, ui.confirm.text) + '  ' + paint(C.bold, '(S/N)'));
  // Sem espaço (pergunta aberta em 80×24): tira linhas em branco, de baixo para cima.
  while (lines.length > height && lines.includes('')) lines.splice(lines.lastIndexOf(''), 1);
  return lines;
}

export function key(ctx, k) {
  const ui = ctx.ui;
  if (ui.confirm) {
    if (k === 's' || k === 'S') { const { run } = ui.confirm; ui.confirm = null; run(); }
    else if (k === 'n' || k === 'N' || k === 'escape') ui.confirm = null;
    return true;
  }
  const { c, tier } = clamp(ctx);
  if (k === 'up') { ui.sel--; return true; }
  if (k === 'down') { ui.sel++; return true; }
  if (k === 'left' || k === 'right') {
    if (!c) return true; // a semente do dia não tem nível
    ui.tier[c.id] = tier + (k === 'left' ? -1 : 1);
    if (k === 'right' && tier === maxPlayable(ctx, c) && tier < MAX_TIER) ctx.say(`Complete o nível ${ROMAN[tier - 1]} para liberar o próximo.`, 'info');
    return true;
  }
  if (k === 'c' || k === 'C') {
    if (ctx.challengeRun) ctx.continueChallenge();
    else ctx.say('Nenhuma partida de desafio no slot D ainda.', 'info');
    return true;
  }
  if (k !== 'enter') return false;
  const run = ctx.challengeRun?.run;
  const same = run && !run.done && (c ? run.challenge === c.id && run.tier === tier : run.daily === ctx.today);
  if (same) { ctx.continueChallenge(); return true; }
  const start = c ? () => ctx.startChallenge(c.id, tier) : () => ctx.startDaily();
  const target = c ? `${c.name} ${ROMAN[tier - 1]}` : `a semente do dia ${dayLabel(ctx.today)}`;
  if (run && !run.done) ui.confirm = { text: `Abandonar ${runName(run)} e começar ${target}?`, run: start };
  else start();
  return true;
}
