// Tudo aqui roda sem TTY: o screen devolve
// strings e o parser recebe strings, então dá para verificar byte a byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKeys } from '../src/ui/input.js';
import { visibleLength, charWidth } from '../src/ui/format.js';
import { createScreen, parseLine } from '../src/ui/screen.js';
import { C, paint } from '../src/ui/theme.js';
import { tooSmall, renderTooSmall } from '../src/ui/screens/too-small.js';

test('parseKeys: setas, enter, esc, tab, shift+tab, F-keys', () => {
  assert.deepEqual(parseKeys('\x1b[A\x1b[B\x1b[C\x1b[D'), ['up', 'down', 'right', 'left']);
  assert.deepEqual(parseKeys('\x1bOA'), ['up']); // modo aplicação
  assert.deepEqual(parseKeys('\r'), ['enter']);
  assert.deepEqual(parseKeys('\x1b'), ['escape']);
  assert.deepEqual(parseKeys('\t\x1b[Z'), ['tab', 'shift-tab']);
  assert.deepEqual(parseKeys('\x1bOP\x1b[15~\x1b[24~'), ['f1', 'f5', 'f12']);
  assert.deepEqual(parseKeys('\x1b[[A'), ['f1']); // console do Linux
});

test('parseKeys: várias teclas por chunk, ctrl, alt, modificadores', () => {
  assert.deepEqual(parseKeys('ab G'), ['a', 'b', 'space', 'G']);
  assert.deepEqual(parseKeys('\x03'), ['ctrl-c']);
  assert.deepEqual(parseKeys('\x7f'), ['backspace']);
  assert.deepEqual(parseKeys('\x1bx'), ['alt-x']);
  assert.deepEqual(parseKeys('\x1b[1;5A'), ['ctrl-up']);
  assert.deepEqual(parseKeys('\x1b[3~\x1b[5~'), ['delete', 'pageup']);
  assert.deepEqual(parseKeys('\x1b\x1b[A'), ['escape', 'up']);
  assert.deepEqual(parseKeys('ç⚡'), ['ç', '⚡']);
});

test('visibleLength ignora ANSI e conta caracteres largos como 2', () => {
  assert.equal(visibleLength('abc'), 3);
  assert.equal(visibleLength(paint(C.bold + C.green, 'Olá')), 3);
  assert.equal(visibleLength('⚡ X'), 4);
  assert.equal(visibleLength('é'), 1); // e + acento combinante
  assert.equal(visibleLength('┌─┐░▒▓█'), 7);
  assert.equal(charWidth(0x1b), 0);
});

test('parseLine: estilos acumulam, reset limpa, corta na largura', () => {
  const cells = parseLine(`a${C.bold}${C.green}b${C.reset}c`, 5);
  assert.equal(cells.length, 5);
  assert.deepEqual(cells.slice(0, 3).map((x) => x.ch), ['a', 'b', 'c']);
  assert.equal(cells[0].st, '');
  assert.equal(cells[1].st, C.bold + C.green);
  assert.equal(cells[2].st, '');
  assert.equal(parseLine('abcdefgh', 4).map((x) => x.ch).join(''), 'abcd');
  // caractere largo ocupa 2 células e não é cortado pela metade
  assert.deepEqual(parseLine('⚡', 2).map((x) => x.ch), ['⚡', '']);
  assert.deepEqual(parseLine('a⚡', 2).map((x) => x.ch), ['a', ' ']);
});

test('screen: 1º quadro completo, quadro igual não emite nada', () => {
  const sc = createScreen();
  sc.resize(10, 3);
  const first = sc.frame(['hello', '', 'world']);
  assert.match(first, /\x1b\[2J/);
  assert.match(first, /hello/);
  assert.equal(sc.frame(['hello', '', 'world']), '');
});

test('screen: só a célula alterada é emitida, na posição certa', () => {
  const sc = createScreen();
  sc.resize(10, 3);
  sc.frame(['hello', '', 'world']);
  assert.equal(sc.frame(['hello', '', 'wOrld']), '\x1b[3;2HO');
  // vizinhas alteradas saem em sequência, sem reposicionar o cursor
  assert.equal(sc.frame(['hEYlo', '', 'wOrld']), '\x1b[1;2HEY');
  // mudança de cor também conta como diferença
  const out = sc.frame([`hEYlo`, '', `wOrl${C.red}d${C.reset}`]);
  assert.equal(out, `\x1b[3;5H${C.reset}${C.red}d${C.reset}`);
});

test('screen: resize e invalidate forçam redesenho completo', () => {
  const sc = createScreen();
  sc.resize(10, 3);
  sc.frame(['a']);
  sc.resize(10, 3);
  assert.equal(sc.frame(['a']), ''); // mesmo tamanho: nada muda
  sc.resize(12, 3);
  assert.match(sc.frame(['a']), /\x1b\[2J/);
  sc.invalidate();
  assert.match(sc.frame(['a']), /\x1b\[2J/);
});

test('aviso de terminal pequeno', () => {
  assert.equal(tooSmall(80, 24), false);
  assert.equal(tooSmall(79, 24), true);
  assert.equal(tooSmall(80, 23), true);
  assert.ok(renderTooSmall(40, 10).some((l) => l.includes('40×10')));
});

test('scrollWindow: lista curta passa direto; longa mostra janela em volta da seleção', async () => {
  const { scrollWindow } = await import('../src/ui/list.js');
  const items = Array.from({ length: 20 }, (_, i) => `item${i}`);
  assert.deepEqual(scrollWindow(items.slice(0, 5), 0, 10), items.slice(0, 5));
  const top = scrollWindow(items, 0, 10).map(stripAnsiLocal);
  assert.equal(top.length, 10);
  assert.equal(top[0], '');
  assert.equal(top[1], 'item0');
  assert.match(top[9], /↓ mais 12/);
  const mid = scrollWindow(items, 10, 10).map(stripAnsiLocal);
  assert.match(mid[0], /↑ mais/);
  assert.ok(mid.includes('item10'));
  const end = scrollWindow(items, 19, 10).map(stripAnsiLocal);
  assert.equal(end[8], 'item19');
  assert.equal(end[9], '');
});
const stripAnsiLocal = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
