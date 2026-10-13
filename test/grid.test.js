import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/ui/app.js';
import { newState } from '../src/core/state.js';
import { allocateCells, flowArrow } from '../src/ui/screens/grid.js';
import { bar, sparkline, fmtPct, visibleLength, stripAnsi } from '../src/ui/format.js';
import { setUnicode } from '../src/ui/theme.js';

function open(state) {
  const app = createApp({
    store: { list: () => [{ slot: 1, status: 'ok', savedAt: null, state }], load: () => ({ status: 'ok', savedAt: null, state }), save: () => true, remove() {} },
    now: 0,
  });
  app.key('1');
  app.key('r');
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, text };
}

const bigState = () => {
  const s = newState();
  for (const t of ['t_solar', 't_hydro', 't_biomass', 't_gas', 't_geo', 't_nuclear', 't_tidal', 't_fusion', 't_antimatter']) s.techs[t] = true;
  for (const id of Object.keys(s.owned)) s.owned[id] = 150;
  for (const id of Object.keys(s.upgrades)) s.upgrades[id] = 5;
  s.money = 1e30;
  return s;
};

test('bar e sparkline', () => {
  assert.equal(bar(0.5, 10), '█████░░░░░');
  assert.equal(bar(2, 4), '████');
  assert.equal(bar(NaN, 3), '░░░');
  assert.equal(sparkline([0, 7], 2), '▁█');
  assert.equal(sparkline([3, 3, 3], 3), '▄▄▄'); // série constante: meio, sem dividir por zero
  assert.equal(sparkline([], 4), '    ');
  assert.equal(sparkline([1, 2], 5), '   ▁█'); // poucos pontos: alinhado à direita
  assert.equal(fmtPct(0.5), '50%');
  assert.equal(fmtPct(123), '>999%');
});

test('modo ASCII troca os glifos', () => {
  setUnicode(false);
  try {
    assert.equal(bar(0.5, 4), '##..');
    assert.equal(sparkline([0, 7], 2), '_#');
  } finally {
    setUnicode(true);
  }
});

test('allocateCells: uma célula por usina se couber; senão proporcional, mínimo 1 por fonte', () => {
  assert.deepEqual(allocateCells({ wind: 3, solar: 2, gas: 0 }), { wind: 3, solar: 2 });
  const big = allocateCells({ wind: 1000, solar: 10, nuclear: 1 });
  assert.equal(Object.values(big).reduce((a, b) => a + b, 0), 72);
  assert.ok(big.nuclear >= 1 && big.solar >= 1);
  assert.ok(big.wind > 60);
  const many = allocateCells(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`g${i}`, 1000 + i])), 12);
  assert.equal(Object.values(many).reduce((a, b) => a + b, 0), 12);
});

test('flowArrow: largura fixa, mais ">" para fonte maior, anda com o tempo', () => {
  assert.equal(visibleLength(flowArrow(0.9, 0)), 8);
  const count = (s) => [...s].filter((c) => c === '>').length;
  assert.ok(count(flowArrow(0.9, 0)) > count(flowArrow(0.01, 0)));
  assert.notEqual(flowArrow(0.5, 0), flowArrow(0.5, 150));
  assert.equal(stripAnsi(flowArrow(0, 0)), '········');
});

test('V alterna Mapa → Fluxo → Gráfico → Calor → Mapa', () => {
  const s = newState();
  s.owned.wind = 5;
  const { app, text } = open(s);
  assert.match(text(), /ociosa/);
  app.key('v'); assert.match(text(), /MERCADO/);
  app.key('v'); assert.match(text(), /Participação agora/);
  app.key('V'); assert.match(text(), /Nenhum reator ainda/);
  app.key('v'); assert.match(text(), /ociosa/);
});

test('T compra transformador; sem dinheiro avisa', () => {
  const s = newState();
  const { app, text } = open(s);
  app.key('t');
  assert.match(text(), /Faltam \$2\.00k para o transformador/);
  s.money = 5000;
  app.key('T');
  assert.equal(s.transformers, 1);
  assert.match(text(), /Transformador instalado: capacidade 180\.0 kW/);
});

test('Calor: ↑↓ escolhe o reator e C compra resfriamento', () => {
  const s = newState();
  s.techs = { t_solar: 1, t_hydro: 1, t_gas: 1, t_nuclear: 1, t_fusion: 1 };
  s.owned.nuclear = 2;
  s.owned.fusion = 1;
  s.money = 1e9;
  const { app, text } = open(s);
  app.key('down'); // vai para a visão Calor e seleciona o 2º reator
  assert.match(text(), /› Reator de Fusão/);
  app.key('c');
  assert.equal(s.cooling.fusion, 1);
  assert.match(text(), /Resfriamento: Torres de Resfriamento \(Reator de Fusão\)/);
  app.key('up');
  app.key('c');
  assert.equal(s.cooling.nuclear, 1);
});

test('desligamento por superaquecimento gera mensagem e aparece nas telas', () => {
  const s = newState();
  s.techs = { t_solar: 1, t_hydro: 1, t_gas: 1, t_nuclear: 1, t_fusion: 1, t_antimatter: 1 };
  s.owned.antimatter = 1;
  const { app, text } = open(s);
  for (let i = 0; i < 1200 && !/superaqueceu/.test(text()); i++) app.update(0.1, i * 100);
  assert.match(text(), /Antimatéria superaqueceu e desligou/);
  app.key('v'); app.key('v'); app.key('v');
  assert.match(text(), /DESLIGADO \d+s/);
  app.key('g');
  assert.match(text(), /DESLIGADO \d+s/);
});

test('todas as visões cabem em 80×24, inclusive com rede absurdamente saturada', () => {
  for (const state of [newState(), bigState()]) {
    const { app } = open(state);
    for (let i = 0; i < 65; i++) app.update(1, i * 1000);
    for (let v = 0; v < 4; v++) {
      for (const now of [0, 150, 300, 450]) {
        app.update(0, now + 70000);
        const lines = app.lines(80, 24);
        assert.equal(lines.length, 24);
        for (const l of lines) assert.ok(visibleLength(l) <= 80, `visão ${v}: ${stripAnsi(l)} (${visibleLength(l)})`);
      }
      app.key('v');
    }
  }
});
