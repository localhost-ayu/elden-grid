import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readChangelog } from '../src/storage/changelog.js';
import { parseChangelog } from '../src/ui/screens/news.js';
import { createApp } from '../src/ui/app.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

function make(changelog) {
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, status: 'empty' })), load: () => null, save: () => true, remove() {} };
  const app = createApp({ store, now: 0, changelog: () => changelog });
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, text };
}

test('changelog: lido do disco, com uma marca por versão e linhas na largura', () => {
  const md = readChangelog();
  assert.ok(md && md.includes('## [1.0.0]'));
  const p = parseChangelog(md, 76);
  const versions = (md.match(/^## \[/gm) ?? []).length;
  assert.equal(p.versions.length, versions);
  for (const l of p.lines) assert.ok(visibleLength(l) <= 76, stripAnsi(l));
  assert.ok(!p.lines.some((l) => /\]: https:/.test(stripAnsi(l))), 'links de comparação ficam de fora');
  assert.ok(!p.lines.some((l) => stripAnsi(l).includes('**')), 'sem marcação de negrito');
  assert.equal(readChangelog('/nao/existe.md'), null);
});

test('menu: Novidades rola e pula de versão; Créditos agradecem; tudo em 80×24', () => {
  const { app, text } = make(readChangelog());
  app.key('6');
  assert.match(text(), /Novidades/);
  assert.match(text(), /✦ /);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  const first = text();
  app.key('right');
  app.key('right');
  assert.notEqual(text(), first, '→ pula de versão');
  app.key('pagedown');
  app.key('left');
  app.key('escape');
  assert.equal(app.mode, 'menu');
  app.key('7');
  assert.match(text(), /Obrigado por jogar!/);
  assert.match(text(), /Nathã Grazzioli/);
  for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  app.key('escape');
  const none = make(null);
  none.app.key('6');
  assert.match(none.text(), /CHANGELOG\.md não foi encontrado/);
});
