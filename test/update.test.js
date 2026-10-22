// Versão e atualização: nada de rede nem git de verdade — fetch e git são falsos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions, latestFromTags, fetchLatestVersion, inspectInstall, isVersion, readVersion, CHECK_EVERY_MS,
} from '../src/storage/update.js';
import { createApp } from '../src/ui/app.js';
import { stripAnsi } from '../src/ui/format.js';

test('semver: compara por número, não por texto; aceita "v"', () => {
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
  assert.ok(compareVersions('v1.2.0', '1.1.0') > 0);
  assert.equal(compareVersions('1.1.0', 'v1.1.0'), 0);
  assert.ok(compareVersions('0.9.0', '1.0.0') < 0);
  assert.ok(isVersion('1.2.3') && isVersion('v1.2.3') && !isVersion('1.2') && !isVersion(null));
  assert.match(readVersion(), /^\d+\.\d+\.\d+$/);
});

test('tags do GitHub: maior versão, ignorando tags que não são vX.Y.Z', () => {
  assert.equal(latestFromTags([{ name: 'v1.0.0' }, { name: 'v1.10.0' }, { name: 'v1.9.0' }, { name: 'nightly' }]), '1.10.0');
  assert.equal(latestFromTags([]), null);
  assert.equal(latestFromTags({ message: 'API rate limit exceeded' }), null);
});

test('fetchLatestVersion nunca lança: sem rede, HTTP de erro ou JSON estranho = null', async () => {
  const ok = async () => ({ ok: true, json: async () => [{ name: 'v2.0.0' }] });
  assert.equal(await fetchLatestVersion({ fetchImpl: ok }), '2.0.0');
  assert.equal(await fetchLatestVersion({ fetchImpl: async () => { throw new TypeError('fetch failed'); } }), null);
  assert.equal(await fetchLatestVersion({ fetchImpl: async () => ({ ok: false, status: 403 }) }), null);
  assert.equal(await fetchLatestVersion({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }) }), null);
  // Timeout: o sinal aborta uma requisição que nunca responde. O intervalo faz o papel do
  // socket aberto (o timer do AbortSignal.timeout sozinho não segura o processo).
  const hang = (url, { signal }) => new Promise((_, reject) => {
    const socket = setInterval(() => {}, 1000);
    signal.addEventListener('abort', () => { clearInterval(socket); reject(signal.reason); });
  });
  const t0 = Date.now();
  assert.equal(await fetchLatestVersion({ fetchImpl: hang, timeoutMs: 50 }), null);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(await fetchLatestVersion({ fetchImpl: null }), null); // null: sem fetch (undefined usaria o real)
});

test('inspectInstall: só um clone limpo na main pode se atualizar sozinho', () => {
  const git = (answers) => (args) => {
    const r = answers[args.join(' ')];
    if (r instanceof Error) throw r;
    return r ?? '';
  };
  const base = { 'rev-parse --is-inside-work-tree': 'true\n', 'rev-parse --abbrev-ref HEAD': 'main\n', 'status --porcelain --untracked-files=no': '' };
  assert.deepEqual(inspectInstall('.', git(base)), { canPull: true });
  assert.match(inspectInstall('.', git({ ...base, 'rev-parse --abbrev-ref HEAD': 'dev\n' })).reason, /branch dev/);
  assert.match(inspectInstall('.', git({ ...base, 'status --porcelain --untracked-files=no': ' M index.js\n' })).reason, /mudanças locais/);
  assert.match(inspectInstall('.', git({ 'rev-parse --is-inside-work-tree': new Error('not a git repository') })).reason, /git/);
});

// App com updater falso. `latest` pode ser versão, null (offline) ou erro.
function make({ latest = null, settings = {}, inspect = { canPull: true }, pull = { ok: true }, now = 10 * CHECK_EVERY_MS } = {}) {
  const calls = { latest: 0, pull: 0, saved: 0 };
  const updater = {
    version: '1.1.0',
    latest: async () => { calls.latest++; if (latest instanceof Error) throw latest; return latest; },
    inspect: () => inspect,
    pull: async () => { calls.pull++; return pull; },
  };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, status: 'empty' })), load: () => ({ status: 'empty' }), save: () => true, remove() {} };
  const app = createApp({ store, settings, now, updater, onSettings: () => calls.saved++ });
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, calls, settings, text };
}
const settle = () => new Promise((r) => setImmediate(r));

test('título mostra a versão; com versão nova, avisa e oferece Atualizar', async () => {
  const same = make({ latest: '1.1.0' });
  await settle();
  assert.match(same.text(), /v1\.1\.0/);
  assert.doesNotMatch(same.text(), /Nova versão|Atualizar/);

  const newer = make({ latest: '1.2.0' });
  await settle();
  assert.equal(newer.settings.latestVersion, '1.2.0');
  assert.match(newer.text(), /Nova versão 1\.2\.0 disponível!/);
  assert.match(newer.text(), /8 {2}Atualizar/);
  assert.match(newer.text(), /1-9 atalho/);
});

test('sem conexão (ou erro): nada trava, nada muda, e tenta de novo na próxima abertura', async () => {
  for (const latest of [null, new Error('offline')]) {
    const { calls, settings, text } = make({ latest, settings: { latestVersion: '1.1.0', lastUpdateCheck: 0 } });
    await settle();
    assert.equal(calls.latest, 1);
    assert.equal(settings.lastUpdateCheck, 0); // falhou: não conta como checado
    assert.match(text(), /v1\.1\.0/);
  }
});

test('checa no máximo 1x por dia; desligado em Opções, nunca checa; religar checa na hora', async () => {
  const day = 10 * CHECK_EVERY_MS;
  const recent = make({ latest: '9.0.0', settings: { lastUpdateCheck: day - 1000 }, now: day });
  await settle();
  assert.equal(recent.calls.latest, 0);
  const off = make({ latest: '9.0.0', settings: { updateCheck: false } });
  await settle();
  assert.equal(off.calls.latest, 0);
  const { app, calls, settings } = off;
  app.key('5'); // Opções
  for (let i = 0; i < 7; i++) app.key('down');
  app.key('right');
  assert.equal(settings.updateCheck, true);
  await settle();
  assert.equal(calls.latest, 1);
  assert.equal(settings.latestVersion, '9.0.0');
});

test('Atualizar: clone limpo pergunta S/N e roda git pull; depois pede para reiniciar', async () => {
  const { app, calls, text } = make({ latest: '1.2.0' });
  await settle();
  app.key('8'); // Atualizar (depois de Novidades e Créditos)
  assert.match(text(), /Baixar a versão 1\.2\.0 com git pull\? Seus saves não são tocados\. +\(S\/N\)/);
  app.key('n');
  assert.equal(calls.pull, 0);
  app.key('8'); // Atualizar (depois de Novidades e Créditos)
  app.key('s');
  await settle();
  assert.equal(calls.pull, 1);
  assert.match(text(), /Versão 1\.2\.0 baixada! Saia \(Q\) e abra o jogo de novo/);
  assert.match(text(), /v1\.2\.0 baixada — reinicie o jogo/);
  assert.doesNotMatch(text(), /\d {2}Atualizar/); // não oferece de novo
});

test('Atualizar sem poder usar git (zip, outra branch, mudanças locais): instrução manual', async () => {
  const { app, calls, text } = make({ latest: '1.2.0', inspect: { canPull: false, reason: 'há mudanças locais nos arquivos do jogo' } });
  await settle();
  app.key('8'); // Atualizar (depois de Novidades e Créditos)
  assert.equal(calls.pull, 0);
  assert.match(text(), /Atualização manual: há mudanças locais/);
});

test('git pull falhou: avisa o motivo e deixa tentar de novo', async () => {
  const { app, text } = make({ latest: '1.2.0', pull: { ok: false, reason: 'Could not resolve host: github.com' } });
  await settle();
  app.key('8'); // Atualizar (depois de Novidades e Créditos)
  app.key('s');
  await settle();
  assert.match(text(), /Não deu para atualizar: Could not resolve host/);
  assert.match(text(), /8 {2}Atualizar/);
});
