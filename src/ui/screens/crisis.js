// Manual de crise: o que está acontecendo, como resolver, quanto custa não resolver, e o
// minijogo. Abre por cima da aba atual (tecla X) e o jogo continua rodando por trás.
import { REWARD } from '../../data/events.js';
import { eventDef } from '../../core/events.js';
import { beginCrisis, callCrew, crisisDef, crisisInput, damage } from '../../core/incidents.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt, fmtClock, bar } from '../format.js';

export const help = (ctx) => {
  if (ctx.ui.confirm) return 'S chamar a equipe  N/Esc cancelar';
  const game = ctx.state.events.crisis?.game;
  if (!game) return 'Enter começar  P chamar a equipe  Esc voltar ao jogo (a crise continua)';
  return { timing: 'ESPAÇO na faixa', mash: 'alterne ← →', sequence: 'setas na ordem' }[game.kind] + '  P chamar a equipe  Esc voltar';
};

const dots = (n, total, on = glyphs().dot, off = glyphs().dotEmpty) => on.repeat(n) + off.repeat(Math.max(0, total - n));
// Acerto/erro pisca por 0.3 s depois da tecla.
const flash = (g) => (g.last && g.time - g.last.at < 0.3 ? g.last.ok : null);

const TRACK = 50;

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

function mashWidget(g) {
  const gl = glyphs();
  const want = g.prev === 'left' ? 'right' : g.prev === 'right' ? 'left' : null;
  const key = (dir) => paint(want === dir || want === null ? C.bold + C.yellow + C.inverse : C.dim, ` ${gl.arrow[dir]} `);
  const f = flash(g);
  return [
    '',
    '   ' + `pressão ${paint(f === false ? C.red : C.cyan, bar(g.fill, 36))} ${String(Math.round(g.fill * 100)).padStart(3)}%`,
    '   ' + `${key('left')} ${key('right')}` + paint(C.dim, `   tempo ${g.timeLeft.toFixed(1)} s`) +
      (f === false ? paint(C.red, '   alterne as setas!') : ''),
  ];
}

function sequenceWidget(g) {
  const gl = glyphs();
  const f = flash(g);
  const seq = g.seq.map((d, i) => {
    if (i < g.idx) return paint(C.green, gl.arrow[d]);
    if (i === g.idx) return paint(C.bold + (f === false ? C.red : C.yellow) + C.inverse, gl.arrow[d]);
    return paint(C.dim, gl.arrow[d]);
  });
  return [
    '',
    '   ' + seq.join('  '),
    '   ' + `erros ${paint(C.red, dots(g.errors, g.maxErrors, gl.off, gl.dotEmpty))}` + paint(C.dim, `   tempo ${g.timeLeft.toFixed(1)} s`),
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
    '   ' + paint(C.bold, `Manual de crise · ${manual.title}`),
    ...manual.steps.map((step, i) => paint(C.dim, `   ${i + 1}. ${step}`)),
  ];
  lines.push(...(c.game ? WIDGET[c.game.kind](c.game) : ['', '   ' + paint(C.bold + C.yellow, 'Enter começa quando você estiver pronto.'), '']));
  lines.push(
    '',
    '   ' + paint(C.green, `Resolver você mesmo: grátis + ${REWARD.name} (produção x${REWARD.effects[0].mult} por ${REWARD.duration} s)`),
    '   ' + paint(C.yellow, `Falhar ou chamar a equipe [P]: $${fmt(cost)}`) + paint(C.dim, '  (até 10% do caixa ou 1 min de renda)'),
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
