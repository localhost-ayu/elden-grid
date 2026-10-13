// Usada por "Novo jogo" e "Carregar slot" (ui.purpose = 'new' | 'load'). Também é onde
// o jogador descobre que um save está corrompido e pode recomeçar nele.
import { C, paint } from '../theme.js';
import { fmt, fmtDuration } from '../format.js';

export const help = '↑↓ + Enter escolher  1-3 atalho  Del/X apagar  Esc voltar';
export const confirmHelp = 'S confirmar  N/Esc cancelar';

const used = (sl) => sl.status === 'ok' || sl.status === 'recovered';

function describe(ctx, sl) {
  if (sl.status === 'empty') return paint(C.dim, '— vazio —');
  if (sl.status === 'corrupt') return paint(C.red, '⚠ save ilegível (backup também) — Enter recomeça aqui');
  // O slot aberto agora mostra o estado em memória, mais novo que o do disco.
  const s = sl.slot === ctx.currentSlot && ctx.state ? ctx.state : sl.state;
  const ago = sl.savedAt != null ? ` · salvo há ${fmtDuration((ctx.now - sl.savedAt) / 1000)}` : '';
  return paint(C.green, '$' + fmt(s.money)) + ' · ' + paint(C.cyan, fmt(s.totalEnergy) + ' kWh') +
    paint(C.dim, ` · ${fmtDuration(s.t)} de jogo${ago}`) +
    (sl.status === 'recovered' ? paint(C.yellow, ' (do backup)') : '');
}

export function render(ctx) {
  const ui = ctx.ui;
  const slots = ctx.slots;
  ui.sel = Math.max(0, Math.min(ui.sel ?? 0, slots.length - 1));
  const title = ui.purpose === 'new' ? 'Novo jogo — escolha um slot' : 'Carregar — escolha um slot';
  const lines = ['', '   ' + paint(C.bold, title), ''];
  slots.forEach((sl, i) => {
    const selected = i === ui.sel;
    const label = `${selected ? '▸' : ' '} Slot ${sl.slot}` + (sl.slot === ctx.currentSlot ? '*' : ' ');
    lines.push('   ' + paint(selected ? C.bold + C.yellow : '', label) + '  ' + describe(ctx, sl));
  });
  if (ctx.currentSlot) lines.push('', paint(C.dim, '   * slot aberto agora'));
  if (ui.confirm) {
    lines.push('', '   ' + paint(C.yellow + C.bold, ui.confirm.text) + '  ' + paint(C.bold, '(S/N)'));
  }
  return lines;
}

function choose(ctx, sl) {
  const ui = ctx.ui;
  const fresh = () => ctx.newGame(sl.slot);
  if (ui.purpose === 'load' && used(sl)) return ctx.loadSlot(sl.slot);
  if (sl.status === 'empty') return fresh();
  if (sl.status === 'corrupt') {
    ui.confirm = { text: `Save do slot ${sl.slot} ilegível. Começar novo jogo nele?`, run: fresh };
  } else {
    ui.confirm = { text: `Sobrescrever o slot ${sl.slot}? O progresso dele será perdido.`, run: fresh };
  }
}

export function key(ctx, k) {
  const ui = ctx.ui;
  const slots = ctx.slots;
  if (ui.confirm) {
    // Enquanto a pergunta está na tela, nenhuma outra tecla vaza (nem q).
    if (k === 's' || k === 'S') { const { run } = ui.confirm; ui.confirm = null; run(); }
    else if (k === 'n' || k === 'N' || k === 'escape') ui.confirm = null;
    return true;
  }
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(slots.length - 1, (ui.sel ?? 0) + 1); return true; }
  if (/^[1-9]$/.test(k) && slots[Number(k) - 1]) { ui.sel = Number(k) - 1; choose(ctx, slots[ui.sel]); return true; }
  if (k === 'enter') { choose(ctx, slots[ui.sel ?? 0]); return true; }
  if (k === 'delete' || k === 'x' || k === 'X') {
    const sl = slots[ui.sel ?? 0];
    if (sl.status === 'empty') return true;
    ui.confirm = { text: `Apagar o slot ${sl.slot} (e o backup)? Não dá para desfazer.`, run: () => ctx.deleteSlot(sl.slot) };
    return true;
  }
  return false;
}
