import os from 'node:os';
import {
  listSlots, readSlot, writeSlot, deleteSlot, importLegacy, exportSlot, importSlot, moveOldSaveDir,
} from './src/storage/saves.js';
import { readSettings, writeSettings } from './src/storage/settings.js';
import { updater } from './src/storage/update.js';
import * as term from './src/ui/term.js';
import { parseKeys } from './src/ui/input.js';
import { createScreen } from './src/ui/screen.js';
import { createApp } from './src/ui/app.js';

if (!term.isInteractive()) {
  console.error('Rode em um terminal interativo (TTY).');
  process.exit(1);
}

// Saves de versões antigas: a pasta do tempo em que o jogo se chamava Reactor ASCII é
// movida, e o save único do MVP (~/.reactor-ascii.json) é importado para o slot 1.
const moved = moveOldSaveDir();
const imported = importLegacy();
const settings = readSettings();
if (imported) { settings.lastSlot = 1; writeSettings(settings); }

const screen = createScreen();

// Usuário e máquina de verdade no prompt do disfarce "terminal vazio".
function whoami() {
  let user = process.env.USER || process.env.USERNAME || 'dev';
  try { user = os.userInfo().username || user; } catch {}
  return { user, host: os.hostname().split('.')[0] || 'localhost' };
}

// Nenhum slot é carregado aqui: o jogador escolhe no menu (Continuar / Carregar slot),
// e é nessa hora que o progresso offline é calculado.
const app = createApp({
  store: {
    list: () => listSlots(),
    load: (n) => readSlot(n),
    save: (n, s) => writeSlot(n, s),
    remove: (n) => deleteSlot(n),
    exportText: (n) => exportSlot(n),
    importText: (n) => importSlot(n),
  },
  settings,
  onSettings: (s) => { writeSettings(s); applyRuntime(); },
  onQuit: quit,
  // https://no-color.org: presente e não vazio = sem cor.
  noColor: Boolean(process.env.NO_COLOR),
  copy: term.copy,
  who: whoami(),
  // ELDEN_GRID_NO_UPDATE_CHECK=1: nada de rede (a versão continua aparecendo).
  updater: process.env.ELDEN_GRID_NO_UPDATE_CHECK ? { ...updater, latest: async () => null } : updater,
});
if (moved) app.say('Saves do Reactor ASCII movidos para ~/.elden-grid/.', 'ok', 10000);
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
function frame() {
  const now = Date.now();
  app.update((now - last) / 1000, now); // dt real: o jogo não depende da taxa de frames
  last = now;
  draw();
}

// fps e autosave mudam pela tela de Opções: os timers são refeitos só quando mudam.
const timers = { fps: null, autosave: null, loop: null, saver: null };
function applyRuntime() {
  screen.setAscii(!settings.unicode);
  if (timers.fps !== settings.fps) {
    clearInterval(timers.loop);
    timers.loop = setInterval(frame, 1000 / settings.fps);
    timers.fps = settings.fps;
  }
  if (timers.autosave !== settings.autosaveSec) {
    clearInterval(timers.saver);
    timers.saver = setInterval(save, settings.autosaveSec * 1000);
    timers.autosave = settings.autosaveSec;
  }
}
applyRuntime();

// Gancho de teste manual: ELDEN_GRID_CRASH_TEST=<ms> lança uma exceção depois de <ms>,
// para verificar que o terminal é restaurado mesmo em erro não tratado.
if (process.env.ELDEN_GRID_CRASH_TEST) {
  setTimeout(() => { throw new Error('falha forçada (ELDEN_GRID_CRASH_TEST)'); }, Number(process.env.ELDEN_GRID_CRASH_TEST) || 1000);
}
