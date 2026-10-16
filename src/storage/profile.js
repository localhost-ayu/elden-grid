// Disco do perfil compartilhado (~/.elden-grid/profile.json), com a mesma escrita atômica
// e o mesmo .bak dos saves. Ler nunca lança: arquivo ausente ou corrompido vira um
// perfil novo (o .bak é tentado antes).
import fs from 'node:fs';
import path from 'node:path';
import { SAVE_DIR, writeJsonAtomic } from './saves.js';
import { fromProfile, newProfile } from '../core/profile.js';

export const profilePath = (dir = SAVE_DIR) => path.join(dir, 'profile.json');

const parse = (text) => {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('perfil não é um objeto');
  return fromProfile(raw);
};

export function readProfile(dir = SAVE_DIR) {
  const file = profilePath(dir);
  for (const f of [file, file + '.bak']) {
    try { return parse(fs.readFileSync(f, 'utf8')); } catch {}
  }
  return newProfile();
}

export function writeProfile(profile, dir = SAVE_DIR) {
  try {
    writeJsonAtomic(profilePath(dir), profile, (text) => {
      try { parse(text); return true; } catch { return false; }
    });
    return true;
  } catch {
    return false;
  }
}
