// O CHANGELOG.md que vem com o jogo (raiz do repositório), para a tela Novidades do menu.
// Ler nunca lança: sem o arquivo (cópia sem ele), devolve null e a tela avisa.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHANGELOG_PATH = fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url));

export function readChangelog(file = CHANGELOG_PATH) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}
