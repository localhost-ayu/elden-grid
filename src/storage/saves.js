// Único lugar que toca o disco para saves: o core não sabe onde nem como o jogo é salvo.
// Todas as funções recebem `dir` para os testes usarem uma pasta temporária, nunca a
// do jogador.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate, toSave, fromSave, isValidState } from '../core/state.js';

export const SAVE_DIR = path.join(os.homedir(), '.reactor-ascii');
export const LEGACY_PATH = path.join(os.homedir(), '.reactor-ascii.json'); // save v1, antes dos slots
export const SLOTS = [1, 2, 3];

export const slotPath = (n, dir = SAVE_DIR) => path.join(dir, `slot${n}.json`);

// Gravar direto no arquivo final deixaria um JSON pela metade se o processo morresse no
// meio. Por isso: .tmp + fsync, copia o atual para .bak, e rename (atômico no mesmo
// diretório). `isGood` impede que um arquivo corrompido sobrescreva um .bak bom.
export function writeJsonAtomic(file, obj, isGood = () => true) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(obj));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    if (isGood(fs.readFileSync(file, 'utf8'))) fs.copyFileSync(file, file + '.bak');
  } catch {
    // primeira gravação: nada para guardar no .bak
  }
  fs.renameSync(tmp, file);
}

export function parseSave(text) {
  const env = migrate(JSON.parse(text));
  const state = fromSave(env.state ?? {});
  if (!isValidState(state)) throw new Error('estado inválido no save');
  return { savedAt: env.savedAt ?? null, state };
}

const isGoodSave = (text) => {
  try { parseSave(text); return true; } catch { return false; }
};

// status: 'ok' | 'recovered' (veio do .bak) | 'corrupt' (nem principal nem .bak) | 'empty'
export function readSlot(n, dir = SAVE_DIR) {
  const file = slotPath(n, dir);
  let exists = false;
  for (const [f, status] of [[file, 'ok'], [file + '.bak', 'recovered']]) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    exists = true;
    try { return { status, ...parseSave(text) }; } catch {}
  }
  return { status: exists ? 'corrupt' : 'empty' };
}

// Nunca lança: falha de disco não pode derrubar o jogo (quem chama decide se avisa).
export function writeSlot(n, state, dir = SAVE_DIR, now = Date.now()) {
  if (!isValidState(state)) return false; // não troca um save bom por um estado quebrado
  try {
    writeJsonAtomic(slotPath(n, dir), toSave(state, now), isGoodSave);
    return true;
  } catch {
    return false;
  }
}

export function deleteSlot(n, dir = SAVE_DIR) {
  const file = slotPath(n, dir);
  for (const f of [file, file + '.bak', file + '.tmp']) fs.rmSync(f, { force: true });
}

export const listSlots = (dir = SAVE_DIR) => SLOTS.map((n) => ({ slot: n, ...readSlot(n, dir) }));

// Save em texto (Base64 do arquivo): uma linha só, que sobrevive a copiar/colar em chat,
// e-mail ou nota sem quebrar aspas nem acentos.
export const encodeSave = (state, savedAt) => Buffer.from(JSON.stringify(toSave(state, savedAt))).toString('base64');
export const decodeSave = (text) => parseSave(Buffer.from(String(text).trim(), 'base64').toString('utf8'));

export const exportPath = (n, dir = SAVE_DIR) => path.join(dir, `export-slot${n}.txt`);
export const importPath = (dir = SAVE_DIR) => path.join(dir, 'import.txt');

// Retorna { text, path } ou null se o slot não tem save legível.
export function exportSlot(n, dir = SAVE_DIR) {
  const r = readSlot(n, dir);
  if (r.status !== 'ok' && r.status !== 'recovered') return null;
  const text = encodeSave(r.state, r.savedAt ?? Date.now());
  const file = exportPath(n, dir);
  try { fs.writeFileSync(file, text + '\n'); } catch { return null; }
  return { text, path: file };
}

// Lê <pasta>/import.txt e grava no slot `n`. Retorna { ok } ou { ok: false, reason }.
export function importSlot(n, dir = SAVE_DIR, file = importPath(dir)) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { ok: false, reason: `arquivo não encontrado: ${file}` }; }
  let parsed;
  try { parsed = decodeSave(text); } catch { return { ok: false, reason: 'o texto não é um save válido' }; }
  try {
    writeJsonAtomic(slotPath(n, dir), toSave(parsed.state, parsed.savedAt ?? Date.now()), isGoodSave);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'falha ao gravar o slot' };
  }
}

// O save v1 vira o slot 1. O original não é apagado: é renomeado para .migrated, o que
// preserva uma cópia e impede uma segunda importação.
export function importLegacy(dir = SAVE_DIR, legacyPath = LEGACY_PATH) {
  let text;
  try { text = fs.readFileSync(legacyPath, 'utf8'); } catch { return false; }
  if (readSlot(1, dir).status !== 'empty') return false; // nunca sobrescreve um slot em uso
  let parsed;
  try { parsed = parseSave(text); } catch { return false; } // ilegível: deixa como está
  try {
    writeJsonAtomic(slotPath(1, dir), toSave(parsed.state, parsed.savedAt ?? Date.now()));
    fs.renameSync(legacyPath, legacyPath + '.migrated');
    return true;
  } catch {
    return false;
  }
}
