// Opções do jogador, guardadas separadas do save (trocar de slot ou recomeçar não
// mexe nelas). Arquivo: ~/.reactor-ascii/settings.json
import fs from 'node:fs';
import path from 'node:path';
import { SAVE_DIR, SLOTS, writeJsonAtomic } from './saves.js';

export const AUTOSAVE_CHOICES = [15, 30, 60];

export const DEFAULT_SETTINGS = Object.freeze({
  settingsVersion: 1,
  lastSlot: null,   // slot aberto por último: é o que "Continuar" carrega
  autosaveSec: 15,
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
  if (AUTOSAVE_CHOICES.includes(raw?.autosaveSec)) s.autosaveSec = raw.autosaveSec;
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
