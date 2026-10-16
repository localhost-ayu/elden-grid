// Versão e atualização: a única parte do jogo que fala com a rede e com o git. Nada aqui
// lança erro nem segura o jogo: sem conexão, sem git ou com timeout, a resposta é
// "não sei" (null), e o jogo segue com a última informação conhecida.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = 'localhost-ayu/elden-grid';
export const TAGS_URL = `https://api.github.com/repos/${REPO}/tags?per_page=30`;
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const GAME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CHECK_EVERY_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 3000;

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;
export const isVersion = (v) => typeof v === 'string' && SEMVER.test(v);

// < 0: a é mais velha; 0: iguais; > 0: a é mais nova. Inválidas contam como 0.0.0.
export function compareVersions(a, b) {
  const parts = (v) => (SEMVER.exec(v ?? '') ?? [0, 0, 0, 0]).slice(1).map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export function readVersion(dir = GAME_DIR) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
    return isVersion(v) ? v : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Maior tag vX.Y.Z da resposta da API de tags do GitHub, sem o "v"; null se não houver.
export function latestFromTags(tags) {
  if (!Array.isArray(tags)) return null;
  const versions = tags.map((t) => t?.name).filter(isVersion).map((v) => v.replace(/^v/, ''));
  return versions.sort(compareVersions).at(-1) ?? null;
}

// `fetchImpl` é injetável para os testes. Sem conexão, timeout, limite da API ou JSON
// estranho: null.
export async function fetchLatestVersion({ fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== 'function') return null;
  try {
    const res = await fetchImpl(TAGS_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'elden-grid' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return latestFromTags(await res.json());
  } catch {
    return null;
  }
}

// Só atualiza sozinho um clone git limpo na main: qualquer outra coisa (mudanças locais,
// outra branch, pasta baixada como zip, git ausente) fica com a instrução manual.
// `run(args)` executa git e devolve a saída; injetável nos testes.
const gitSync = (dir) => (args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });

export function inspectInstall(dir = GAME_DIR, run = gitSync(dir)) {
  try {
    if (run(['rev-parse', '--is-inside-work-tree']).trim() !== 'true') return { canPull: false, reason: 'a pasta do jogo não é um clone git' };
    const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch !== 'main') return { canPull: false, reason: `o jogo está na branch ${branch}, não na main` };
    if (run(['status', '--porcelain', '--untracked-files=no']).trim()) return { canPull: false, reason: 'há mudanças locais nos arquivos do jogo' };
    return { canPull: true };
  } catch {
    return { canPull: false, reason: 'git não encontrado ou a pasta não é um clone' };
  }
}

// `git pull --ff-only`: nunca cria merge nem mexe em saves (eles ficam em ~/.elden-grid).
export function pullUpdate(dir = GAME_DIR) {
  return new Promise((resolve) => {
    execFile('git', ['-C', dir, 'pull', '--ff-only'], { timeout: 60000, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, reason: (stderr || err.message).trim().split('\n').at(-1) });
      else resolve({ ok: true, output: stdout.trim() });
    });
  });
}

// O que o app recebe (index.js); os testes passam uma versão falsa com a mesma forma.
export const updater = {
  version: readVersion(),
  latest: () => fetchLatestVersion(),
  inspect: () => inspectInstall(),
  pull: () => pullUpdate(),
};
