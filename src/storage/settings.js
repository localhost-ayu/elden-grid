// Opções do jogador, guardadas separadas do save (trocar de slot ou recomeçar não
// mexe nelas). Arquivo: ~/.elden-grid/settings.json
import fs from 'node:fs';
import path from 'node:path';
import { SAVE_DIR, SLOTS, writeJsonAtomic } from './saves.js';
import { isVersion } from './update.js';

// Valores aceitos de cada opção, na ordem em que a tela de Opções os percorre.
export const CHOICES = Object.freeze({
  animations: ['on', 'reduced', 'off'],
  fps: [5, 10, 15],
  unicode: [true, false],
  colors: ['full', '16', 'none'],
  numbers: ['short', 'sci'],
  autosaveSec: [15, 30, 60],
  disguise: ['build', 'logs', 'shell'],
  updateCheck: [true, false],
});
export const AUTOSAVE_CHOICES = CHOICES.autosaveSec;

export const DEFAULT_SETTINGS = Object.freeze({
  settingsVersion: 1,
  lastSlot: null,   // slot aberto por último: é o que "Continuar" carrega
  animations: 'on',
  fps: 10,
  unicode: true,
  colors: 'full',
  numbers: 'short',
  autosaveSec: 15,
  disguise: 'build', // o que a tecla \ mostra no lugar do jogo (ui/stealth.js)
  updateCheck: true,  // procura versão nova no GitHub (1x por dia, em segundo plano)
  latestVersion: null, // última versão vista no GitHub (sem o "v")
  lastUpdateCheck: 0,  // quando a checagem deu certo pela última vez (ms)
});

const settingsPath = (dir) => path.join(dir, 'settings.json');

// Mescla com os padrões e descarta valores inválidos campo a campo: um settings.json
// editado à mão ou corrompido nunca impede o jogo de abrir.
export function readSettings(dir = SAVE_DIR) {
  let raw = {};
  for (const f of [settingsPath(dir), settingsPath(dir) + '.bak']) {
    try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); break; } catch {}
  }
  const s = { ...DEFAULT_SETTINGS };
  if (SLOTS.includes(raw?.lastSlot)) s.lastSlot = raw.lastSlot;
  for (const [k, values] of Object.entries(CHOICES)) if (values.includes(raw?.[k])) s[k] = raw[k];
  if (isVersion(raw?.latestVersion)) s.latestVersion = raw.latestVersion;
  if (Number.isFinite(raw?.lastUpdateCheck) && raw.lastUpdateCheck > 0) s.lastUpdateCheck = raw.lastUpdateCheck;
  return s;
}

export function writeSettings(settings, dir = SAVE_DIR) {
  try {
    writeJsonAtomic(settingsPath(dir), settings, (text) => {
      try { JSON.parse(text); return true; } catch { return false; }
    });
    return true;
  } catch {
    return false;
  }
}
