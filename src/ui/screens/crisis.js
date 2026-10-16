// Manual de crise: o que está acontecendo, como resolver, quanto custa não resolver, e o
// minijogo. Abre por cima da aba atual (tecla X) e o jogo continua rodando por trás.
import { CRISIS, REWARD } from '../../data/events.js';
import { eventDef } from '../../core/events.js';
import { beginCrisis, callCrew, crisisDef, crisisInput, crisisLevel, damage, damageTerms, rewardDuration } from '../../core/incidents.js';
import { bandEdges, inBand } from '../../core/minigames.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt, fmtClock, bar } from '../format.js';

export const help = (ctx) => {
  if (ctx.ui.confirm) return 'S chamar a equipe  N/Esc cancelar';
  const game = ctx.state.events.crisis?.game;
  if (!game) return 'Enter começar  P chamar a equipe  Esc voltar ao jogo (a crise continua)';
  return { timing: 'ESPAÇO na faixa', mash: 'alterne ← → no ritmo', sequence: 'setas na ordem' }[game.kind] + '  P chamar a equipe  Esc voltar';
};

const dots = (n, total, on = glyphs().dot, off = glyphs().dotEmpty) => on.repeat(n) + off.repeat(Math.max(0, total - n));
// Acerto/erro pisca por 0.3 s depois da tecla.
const flash = (g) => (g.last && g.time - g.last.at < 0.3 ? g.last.ok : null);

const TRACK = 50;

// "8% do caixa ou 45 s de renda", no nível atual.
function terms(s) {
  const { moneyShare, incomeSeconds } = damageTerms(s);
  const sec = Math.round(incomeSeconds);
  const time = sec < 120 ? `${sec} s` : `${Math.round(sec / 60)} min`;
  return `${Math.round(moneyShare * 100)}% do caixa ou ${time} de renda`;
}

function timingWidget(g) {
  const gl = glyphs();
  const cur = Math.min(TRACK - 1, Math.floor(g.pos * TRACK));
  const z0 = Math.floor(g.zone * TRACK);
  const z1 = Math.max(z0, Math.ceil((g.zone + g.width) * TRACK) - 1);
  const f = flash(g);
  let track = '';
  for (let i = 0; i < TRACK; i++) {
    const inZone = i >= z0 && i <= z1;
    track += inZone ? paint(f === true ? C.bold + C.green + C.inverse : C.green, gl.barFull) : paint(f === false ? C.red : C.dim, gl.box.h);
  }
  return [
    '   ' + ' '.repeat(cur + 1) + paint(C.bold + C.yellow, gl.cursor),
    '   ' + paint(C.dim, gl.box.v) + track + paint(C.dim, gl.box.v),
    '   ' + `acertos ${paint(C.green, dots(g.hits, g.need))}   erros ${paint(C.red, dots(g.misses, g.maxMisses, gl.off, gl.dotEmpty))}` +
      paint(C.dim, `   tempo ${g.timeLeft.toFixed(1)} s`),
  ];
}

// Barra da pressão: a faixa verde é onde o alívio enche; a última célula estoura.
function mashWidget(g) {
  const gl = glyphs();
  const [lo, hi] = bandEdges(g);
  const fill = Math.min(TRACK, Math.round(g.fill * TRACK));
  const inside = inBand(g);
  let track = '';
  for (let i = 0; i < TRACK; i++) {
    const at = (i + 0.5) / TRACK;
    const band = at >= lo && at <= hi;
    if (i < fill) track += paint(band ? C.bold + C.green : at > hi ? C.red : C.cyan, gl.barFull);
    else track += paint(band ? C.green : i === TRACK - 1 ? C.red : C.dim, band ? gl.barEmpty : gl.box.h);
  }
  const want = g.prev === 'left' ? 'right' : g.prev === 'right' ? 'left' : null;
  const key = (dir) => paint(want === dir || want === null ? C.bold + C.yellow + C.inverse : C.dim, ` ${gl.arrow[dir]} `);
  const burst = g.burst != null && g.time - g.burst < 0.8;
  const f = flash(g);
  return [
    '',
    '   ' + paint(C.dim, gl.box.v) + track + paint(C.dim, gl.box.v) + paint(burst ? C.red + C.bold : C.dim, burst ? ' ESTOUROU' : ' 100%'),
    '   ' + `alívio ${paint(inside ? C.bold + C.green : C.green, bar(g.held / g.hold, 20))}` +
      `   estouros ${paint(C.red, dots(g.bursts, g.maxBursts, gl.off, gl.dotEmpty))}` + paint(C.dim, `   tempo ${g.timeLeft.toFixed(1)} s`),
    '   ' + `${key('left')} ${key('right')}` +
      (f === false && !burst ? paint(C.red, '   alterne as setas!') : paint(C.dim, inside ? '   segure aí: no ritmo' : g.fill > hi ? '   alta demais: espere vazar' : '   suba até a faixa verde')),
  ];
}

function sequenceWidget(g) {
  const gl = glyphs();
  const f = flash(g);
  const hidden = g.hideAt != null && g.time >= g.hideAt;
  const seq = g.seq.map((d, i) => {
    if (i < g.idx) return paint(C.green, gl.arrow[d]);
    if (hidden) return paint(i === g.idx ? C.bold + (f === false ? C.red : C.yellow) + C.inverse : C.dim, '?');
    if (i === g.idx) return paint(C.bold + (f === false ? C.red : C.yellow) + C.inverse, gl.arrow[d]);
    return paint(C.dim, gl.arrow[d]);
  });
  return [
    '',
    '   ' + seq.join('  '),
    '   ' + `erros ${paint(C.red, dots(g.errors, g.maxErrors, gl.off, gl.dotEmpty))}` + paint(C.dim, `   tempo ${g.timeLeft.toFixed(1)} s`) +
      (g.hideAt == null ? '' : hidden ? paint(C.yellow, '   de memória!') : paint(C.yellow, `   some em ${Math.max(0, g.hideAt - g.time).toFixed(1)} s`)),
  ];
}

const WIDGET = { timing: timingWidget, mash: mashWidget, sequence: sequenceWidget };

export function render(ctx) {
  const s = ctx.state;
  const c = s.events.crisis;
  if (!c) return ['', paint(C.dim, '   Nenhuma crise agora.')];
  const ev = eventDef(c.id);
  const manual = crisisDef(s);
  const blink = Math.floor(ctx.anim / 500) % 2 === 0;
  const cost = damage(s);
  const lines = [
    ' ' + paint(C.red + (blink ? C.bold : ''), `${glyphs().warn} ${ev.name.toUpperCase()}`) + paint(C.dim, `  ·  ${ev.desc}`),
    paint(C.dim, `   Sem ação, a equipe assume em ${fmtClock(Math.max(0, c.deadline - s.t))} e cobra os danos.`),
    '',
    '   ' + paint(C.bold, `Manual de crise · ${manual.title}`) + paint(C.dim, `   ·  crise nível ${crisisLevel(s)}/${CRISIS.maxLevel}`),
    ...manual.steps.map((step, i) => paint(C.dim, `   ${i + 1}. ${step}`)),
  ];
  lines.push(...(c.game ? WIDGET[c.game.kind](c.game) : ['', '   ' + paint(C.bold + C.yellow, 'Enter começa quando você estiver pronto.'), '']));
  lines.push(
    '',
    '   ' + paint(C.green, `Resolver você mesmo: grátis + ${REWARD.name} (produção x${REWARD.effects[0].mult} por ${Math.round(rewardDuration(s))} s)`),
    '   ' + paint(C.yellow, `Falhar ou chamar a equipe [P]: $${fmt(cost)}`) + paint(C.dim, `  (até ${terms(s)})`),
  );
  if (ctx.ui.confirm) lines.push('', '   ' + paint(C.yellow + C.bold, `Chamar a equipe por $${fmt(cost)}?`) + '  ' + paint(C.bold, '(S/N)'));
  return lines;
}

export function key(ctx, k) {
  const s = ctx.state;
  const ui = ctx.ui;
  if (!s.events.crisis) { ctx.close(); return true; }
  if (ui.confirm) {
    if (k === 's' || k === 'S') { ui.confirm = false; ctx.announce(callCrew(s)); ctx.close(); }
    else if (k === 'n' || k === 'N' || k === 'escape') ui.confirm = false;
    return true;
  }
  if (k === 'escape') { ctx.close(); return true; }
  if (k === 'p' || k === 'P') { ui.confirm = true; return true; }
  if (!s.events.crisis.game) {
    if (k === 'enter') beginCrisis(s);
    return true; // antes de começar, nenhuma outra tecla faz nada aqui
  }
  const done = crisisInput(s, k);
  if (done) { ctx.announce(done); ctx.close(); }
  return true;
}
