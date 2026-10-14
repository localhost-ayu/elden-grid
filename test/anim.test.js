import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frame, easeTo, createParticles, spawn, stepParticles } from '../src/ui/anim.js';
import { ART, ART_W, ART_H } from '../src/ui/art/index.js';
import { GENERATORS } from '../src/data/generators.js';
import { visibleLength } from '../src/ui/format.js';
import { createScreen } from '../src/ui/screen.js';
import { newState } from '../src/core/state.js';
import { price, priceBase, priceRising } from '../src/core/engine.js';

test('frame depende só do tempo recebido', () => {
  assert.equal(frame(0, 4), 0);
  assert.equal(frame(999, 4), 3);
  assert.equal(frame(1000, 4), 4);
});

test('easeTo converge sem passar do alvo e independe da taxa de quadros', () => {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 3; i++) a = easeTo(a, 100, 0.1);
  b = easeTo(b, 100, 0.3);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.ok(a < 100 && a > 90);
  for (let i = 0; i < 100; i++) a = easeTo(a, 100, 0.1);
  assert.equal(a, 100); // a cauda encaixa no alvo em vez de tremer
  assert.equal(easeTo(50, 10, 0), 50);
  assert.ok(easeTo(50, 10, 0.1) > 10); // descendo também não passa do alvo
  assert.equal(easeTo(NaN, 7, 0.1), 7);
});

test('partículas sobem, envelhecem, somem e têm teto', () => {
  const ps = createParticles(3);
  spawn(ps, { text: '+1', x: 0.5, y: 0, vy: 4, life: 1 });
  stepParticles(ps, 0.5);
  assert.equal(ps.list[0].y, 2);
  stepParticles(ps, 0.6);
  assert.equal(ps.list.length, 0);
  for (let i = 0; i < 5; i++) spawn(ps, { text: `+${i}`, x: 0, y: 0 });
  assert.deepEqual(ps.list.map((p) => p.text), ['+2', '+3', '+4']); // as mais velhas saem
});

test('toda fonte tem arte, e todo quadro tem o mesmo tamanho', () => {
  for (const g of GENERATORS) assert.ok(ART[g.art], `sem arte: ${g.art}`);
  const infos = [{}, { sun: 0 }, { sun: 0.3 }, { sun: 1 }, { level: 0 }, { level: 1 }, { high: false }];
  for (const [id, mod] of Object.entries(ART)) {
    assert.ok(mod.fps > 0, id);
    for (let f = 0; f < 12; f++) {
      for (const info of infos) {
        const lines = mod.draw(f, info);
        assert.equal(lines.length, ART_H, `${id} quadro ${f}`);
        for (const l of lines) assert.equal(visibleLength(l), ART_W, `${id} quadro ${f}: "${l}"`);
      }
    }
  }
});

test('animações têm movimento de verdade (quadros diferentes)', () => {
  for (const [id, mod] of Object.entries(ART)) {
    const seen = new Set(Array.from({ length: 6 }, (_, f) => mod.draw(f, { sun: 1 }).join('\n')));
    assert.ok(seen.size > 1, id);
  }
});

test('screen: sobreposição só em células vazias, com folga, e procura o vão livre', () => {
  const sc = createScreen();
  sc.resize(20, 1);
  const out = sc.frame(['abc'], [{ row: 0, col: 1, text: '+$1', st: '' }]);
  // a coluna 1 está ocupada: vai para o primeiro vão com 1 coluna de folga (col 4)
  assert.match(out, /\x1b\[1;5H\+\$1/);
  const sc2 = createScreen();
  sc2.resize(5, 1);
  assert.equal(sc2.frame(['abcde'], [{ row: 0, col: 0, text: 'x', st: '' }]).includes('x'), false);
  const sc3 = createScreen();
  sc3.resize(10, 1);
  assert.doesNotThrow(() => sc3.frame([''], [{ row: 5, col: 0, text: 'x', st: '' }])); // fora da tela
});

test('preço: base é a média da oscilação e a tendência segue a derivada', () => {
  const s = newState();
  s.techs.t_grid = true; // preço x1.25
  assert.equal(priceBase(s), 1.25);
  s.t = 0;
  assert.equal(priceRising(s), true);
  assert.equal(price(s), 1.25);
  s.t = 15 * Math.PI; // meio ciclo: descendo
  assert.equal(priceRising(s), false);
});
