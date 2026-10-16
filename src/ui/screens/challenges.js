// Tela de Desafios (tela cheia, pelo menu): escolhe desafio e nível e mostra a partida em
// andamento no slot D. ↑↓ desafio, ←→ nível (até o próximo a completar), Enter joga,
// C continua a partida do slot D.
import { CHALLENGES, GOALS, TIER_MULT } from '../../data/challenges.js';
import { GENERATORS } from '../../data/generators.js';
import { challengeTier, MAX_TIER } from '../../core/profile.js';
import { challengeDef } from '../../core/challenges.js';
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
  if (r.eventGap) parts.push(`eventos ${(1 / r.eventGap).toFixed(1)}x mais frequentes`);
  if (r.crisisWeight) parts.push(`crises ${r.crisisWeight}x mais prováveis`);
  if (r.disabled) parts.push(`sem ${r.disabled.map(genName).join(' e sem ')}${r.noCrank ? ' e sem manivela' : ''}`);
  if (r.start) parts.push(`começa com ${Object.entries(r.start).map(([id, n]) => `${n} ${genName(id)}`).join(', ')}`);
  if (r.capacityExp) parts.push(`Linhas de Alta Tensão rendem x${(20 ** r.capacityExp).toFixed(1)} em vez de x20`);
  if (r.priceHalfLife) parts.push(`preço cai à metade a cada ${Math.round(r.priceHalfLife / 60)} min, até ${Math.round(r.priceFloor * 100)}%`);
  if (r.upkeep) parts.push(`custo de operação x${r.upkeep}`);
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

function clamp(ctx) {
  const ui = ctx.ui;
  ui.sel = Math.max(0, Math.min(ui.sel ?? 0, CHALLENGES.length - 1));
  const c = CHALLENGES[ui.sel];
  ui.tier ??= {};
  ui.tier[c.id] = Math.max(1, Math.min(ui.tier[c.id] ?? maxPlayable(ctx, c), maxPlayable(ctx, c)));
  return { c, tier: ui.tier[c.id] };
}

function runLine(ctx) {
  const run = ctx.challengeRun;
  if (!run) return paint(C.dim, '   Slot D vazio: escolha um desafio e aperte Enter.');
  const def = challengeDef(run.run.challenge);
  const goal = GOALS[run.run.tier - 1];
  const name = `${def?.name ?? run.run.challenge} ${ROMAN[run.run.tier - 1]}`;
  if (run.run.done) return '   ' + paint(C.green, `Slot D: ${name} concluído ✓`) + paint(C.dim, '  (C volta a ele)');
  return '   ' + paint(C.bold, `Em andamento no slot D: ${name}`) + paint(C.dim, `  ${bar(run.earned / goal, 12)} $${fmt(run.earned)} / $${fmt(goal)}`) +
    paint(C.yellow, '  C continua');
}

export function render(ctx) {
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
  const best = ctx.profile.challenges[c.id]?.best ?? {};
  const records = Object.entries(best).map(([t, sec]) => `${ROMAN[t - 1]} ${shortTime(sec)}`).join('  ·  ');
  lines.push(
    '',
    '   ' + paint(C.bold, `${c.name} — nível `) + paint(C.yellow, `‹ ${ROMAN[tier - 1]} ›`) +
      paint(C.dim, `   meta: ganhar $${fmt(GOALS[tier - 1])} na partida`),
    paint(C.dim, `   regra: ${describeRule(c.rules[tier - 1])}`),
    paint(C.dim, `   recordes: ${records || 'nenhum ainda'}`),
    '   ' + paint(C.cyan, `${c.reward.name}: `) + paint(C.dim, `${rewardText(c, 1)} por nível`) +
      (challengeTier(ctx.profile, c.id) ? paint(C.cyan, ` (agora ${rewardValue(c, challengeTier(ctx.profile, c.id))})`) : ''),
    '',
    runLine(ctx),
  );
  if (ui.confirm) lines.push('', '   ' + paint(C.yellow + C.bold, ui.confirm.text) + '  ' + paint(C.bold, '(S/N)'));
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
  if (run && run.challenge === c.id && run.tier === tier && !run.done) { ctx.continueChallenge(); return true; }
  const start = () => ctx.startChallenge(c.id, tier);
  if (run && !run.done) {
    ui.confirm = { text: `Abandonar ${challengeDef(run.challenge)?.name} ${ROMAN[run.tier - 1]} e começar ${c.name} ${ROMAN[tier - 1]}?`, run: start };
  } else start();
  return true;
}
