import { listSlots, readSlot, writeSlot, deleteSlot, importLegacy } from './src/storage/saves.js';
import { readSettings, writeSettings } from './src/storage/settings.js';
import * as term from './src/ui/term.js';
import { parseKeys } from './src/ui/input.js';
import { createScreen } from './src/ui/screen.js';
import { createApp } from './src/ui/app.js';

if (!term.isInteractive()) {
  console.error('Rode em um terminal interativo (TTY).');
  process.exit(1);
}

// Na primeira execução, o save v1 (~/.reactor-ascii.json) é importado para o slot 1.
const imported = importLegacy();
const settings = readSettings();
if (imported) { settings.lastSlot = 1; writeSettings(settings); }

// Nenhum slot é carregado aqui: o jogador escolhe no menu (Continuar / Carregar slot),
// e é nessa hora que o progresso offline é calculado.
const app = createApp({
  store: { list: () => listSlots(), load: (n) => readSlot(n), save: (n, s) => writeSlot(n, s), remove: (n) => deleteSlot(n) },
  settings,
  onSettings: (s) => writeSettings(s),
  onQuit: quit,
});
if (imported) app.say('Save antigo encontrado e importado para o Slot 1.', 'ok', 10000);
const save = () => app.save();

let quitting = false;
function quit() {
  if (quitting) return; // q + sinal ao mesmo tempo não salvam/saem duas vezes
  quitting = true;
  save();
  term.restore();
  process.exit(0);
}

term.guard({
  onQuit: quit,
  // Em erro fatal ainda tentamos salvar: a falha costuma ser de desenho, não do estado.
  onCrash: save,
});
term.enter();

const screen = createScreen();
function draw() {
  const { cols, rows } = term.size();
  screen.resize(cols, rows);
  term.write(screen.frame(app.lines(cols, rows), app.overlays(cols, rows)));
}

// Alguns terminais rearranjam o conteúdo sozinhos ao redimensionar; redesenhar tudo
// imediatamente é mais seguro do que confiar no quadro anterior.
term.onResize(() => { screen.invalidate(); draw(); });

process.stdin.on('data', (data) => parseKeys(data).forEach((k) => app.key(k)));

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  app.update((now - last) / 1000, now); // dt real: o jogo não depende da taxa de frames
  last = now;
  draw();
}, 100);

setInterval(save, settings.autosaveSec * 1000); // autosave (15/30/60 s, em settings.json)

// Gancho de teste manual: REACTOR_CRASH_TEST=<ms> lança uma exceção depois de <ms>,
// para verificar que o terminal é restaurado mesmo em erro não tratado.
if (process.env.REACTOR_CRASH_TEST) {
  setTimeout(() => { throw new Error('falha forçada (REACTOR_CRASH_TEST)'); }, Number(process.env.REACTOR_CRASH_TEST) || 1000);
}
