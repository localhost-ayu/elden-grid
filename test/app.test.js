// O app recebe nomes de tecla e devolve linhas, e o disco é
// substituído por um store em memória — nenhum terminal nem arquivo envolvido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, TABS } from '../src/ui/app.js';
import { newState } from '../src/core/state.js';
import { visibleLength, stripAnsi } from '../src/ui/format.js';

// Store falso com a mesma interface do index.js. `slots` = { n: { status, savedAt, state } }.
function memStore(slots = {}) {
  const data = { ...slots };
  const calls = { save: 0 };
  return {
    data,
    calls,
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(data[n] ?? { status: 'empty' }) })),
    load: (n) => (data[n] ? { ...data[n], state: structuredClone(data[n].state) } : { status: 'empty' }),
    save: (n, state) => { calls.save++; data[n] = { status: 'ok', savedAt: 0, state: structuredClone(state) }; return true; },
    remove: (n) => { delete data[n]; },
  };
}

function make({ slots, settings = {}, now = 0 } = {}) {
  const store = memStore(slots);
  const calls = { quit: 0, settings: 0 };
  const app = createApp({
    store, settings, now,
    onSettings: () => calls.settings++,
    onQuit: () => calls.quit++,
  });
  const press = (...keys) => keys.forEach((k) => app.key(k));
  const text = (cols = 80, rows = 24) => app.lines(cols, rows).map(stripAnsi).join('\n');
  return { app, store, settings, calls, press, text };
}

const saved = (money, savedAt = 0) => ({ status: 'ok', savedAt, state: Object.assign(newState(), { money }) });

// Atalho: abre um jogo novo no slot 1 a partir do menu.
const startNew = (press) => press('2', '1');

test('sem saves: Continuar desabilitado; Novo jogo -> slot vazio começa direto', () => {
  const { app, store, settings, press, text } = make();
  assert.equal(app.mode, 'menu');
  assert.match(text(), /✦ 2  Novo jogo/); // seleção pula o Continuar desabilitado
  press('1');
  assert.equal(app.mode, 'menu');
  press('enter');
  assert.equal(app.mode, 'slots');
  assert.match(text(), /Slot 1 .*— vazio —/);
  press('enter');
  assert.equal(app.mode, 'game');
  assert.equal(app.slot, 1);
  assert.equal(store.data[1].status, 'ok'); // slot ocupado imediatamente
  assert.equal(settings.lastSlot, 1);
});

test('Continuar carrega o último slot usado (settings.lastSlot)', () => {
  const { app, press } = make({ slots: { 1: saved(10), 2: saved(20) }, settings: { lastSlot: 2 } });
  press('1');
  assert.equal(app.slot, 2);
  assert.equal(app.state.money, 20);
});

test('Continuar sem lastSlot pega o save mais recente', () => {
  const { app, press } = make({ slots: { 1: saved(10, 500), 3: saved(30, 900) } });
  press('1');
  assert.equal(app.slot, 3);
});

test('Novo jogo em slot ocupado pede confirmação S/N', () => {
  const { app, store, press, text } = make({ slots: { 1: saved(999) } });
  press('2', '1');
  assert.match(text(), /Sobrescrever o slot 1/);
  press('n');
  assert.equal(app.mode, 'slots');
  assert.equal(store.data[1].state.money, 999);
  press('1', 'S');
  assert.equal(app.mode, 'game');
  assert.equal(app.state.money, 0);
});

test('slot corrompido: aparece na lista e oferece novo jogo sem crash', () => {
  const { app, press, text } = make({ slots: { 2: { status: 'corrupt' } } });
  press('3'); // Carregar slot
  assert.match(text(), /Slot 2 .*ilegível/);
  press('2');
  assert.match(text(), /ilegível\. Começar novo jogo nele\?/);
  press('s');
  assert.equal(app.mode, 'game');
  assert.equal(app.slot, 2);
});

test('slot recuperado do backup avisa o jogador', () => {
  const { app, press, text } = make({ slots: { 1: { ...saved(5), status: 'recovered' } } });
  press('1');
  assert.equal(app.mode, 'game');
  assert.match(text(), /recuperado do backup/);
});

test('progresso offline: tela de resumo com ganhos; qualquer tecla continua', () => {
  const s = newState();
  s.owned.wind = 10;
  const { app, press, text } = make({ slots: { 1: { status: 'ok', savedAt: 0, state: s } }, now: 2 * 3600 * 1000 });
  press('1');
  assert.equal(app.mode, 'offline');
  const t = text();
  assert.match(t, /2 h fora/);
  assert.match(t, /Contaram 1 h \(o limite\)/);
  assert.match(t, /\+18\.00k kWh/); // 10 kW × 3600 s × 50%
  press('x');
  assert.equal(app.mode, 'game');
  assert.equal(app.state.totalEnergy, 18000);
});

test('trocar de slot salva o jogo aberto antes', () => {
  const { app, store, press } = make({ slots: { 1: saved(1), 2: saved(2) } });
  press('1'); // abre slot 1 (lastSlot ausente -> mais recente empata; pega o 1º)
  const opened = app.slot;
  app.state.money = 777;
  press('m', '3', String(opened === 1 ? 2 : 1));
  assert.equal(store.data[opened].state.money, 777);
});

test('apagar slot (Del) pede confirmação e fecha o jogo se era o aberto', () => {
  const { app, store, press } = make({ slots: { 1: saved(1) } });
  press('1', 'm', '3'); // abre slot 1, volta, Carregar slot
  press('delete');
  press('n');
  assert.ok(store.data[1]);
  press('x', 's');
  assert.equal(store.data[1], undefined);
  assert.equal(app.state, null);
  press('escape');
  assert.equal(app.mode, 'menu');
});

test('abas: teclas diretas (maiúscula/minúscula), Tab e Shift+Tab com volta', () => {
  const { app, press } = make();
  startNew(press);
  press('p'); assert.equal(app.tab, 'research');
  press('R'); assert.equal(app.tab, 'grid');
  press('e'); assert.equal(app.tab, 'stats');
  press('tab', 'tab'); assert.equal(app.tab, 'gens'); // options -> volta ao início
  press('shift-tab'); assert.equal(app.tab, 'options');
  press('g'); assert.equal(app.tab, 'gens');
});

test('M e Esc voltam ao menu salvando; q e Ctrl+C saem', () => {
  const { app, store, calls, press } = make();
  startNew(press);
  const before = store.calls.save;
  press('m');
  assert.equal(app.mode, 'menu');
  assert.equal(store.calls.save, before + 1);
  press('1', 'escape');
  assert.equal(app.mode, 'menu');
  press('q');
  press('ctrl-c');
  assert.equal(calls.quit, 2);
});

test('menu > Opções abre a tela e Esc volta', () => {
  const { app, press, text } = make();
  press('5');
  assert.equal(app.mode, 'options');
  assert.match(text(), /Opções/);
  press('escape');
  assert.equal(app.mode, 'menu');
});

test('aba Geradores: setas + Enter e atalho numérico compram', () => {
  const { app, press } = make();
  startNew(press);
  press('space'); // manivela
  assert.equal(app.state.totalEnergy, 1);
  app.state.money = 100;
  press('enter');
  assert.equal(app.state.owned.wind, 1);
  press('1');
  assert.equal(app.state.owned.wind, 2);
});

test('aba Pesquisa: árvore desenhada; bloqueada avisa "Requer", disponível compra', () => {
  const { app, press, text } = make();
  startNew(press);
  press('p');
  app.state.rp = 1000;
  const t = text();
  assert.match(t, /Árvore de pesquisa/);
  assert.match(t, /├─ • Pás Aerodinâmicas/);
  assert.match(t, /│ └─ × Turbinas Offshore/);
  // ordem da árvore: 0 Pás, 1 Offshore, 2 Células, 3 Bifaciais, 4 Baterias, 5 Hidráulica
  press('down', 'down', 'down', 'down', 'down', 'enter');
  assert.equal(app.state.techs.t_hydro, undefined);
  assert.match(text(), /Requer: Células Fotovoltaicas/);
  press('up', 'up', 'up', 'enter'); // t_solar
  assert.equal(app.state.techs.t_solar, true);
  press('down', 'down', 'down', 'enter');
  assert.equal(app.state.techs.t_hydro, true);
  assert.match(text(), /Engenharia Hidráulica — destrava Hidrelétrica/); // painel de detalhes
});

test('mensagens: no máximo 3, a mais nova embaixo, e expiram', () => {
  const { app, text } = make();
  ['um', 'dois', 'tres', 'quatro'].forEach((m) => app.say(m, 'info', 1000));
  const lines = text().split('\n');
  assert.deepEqual(lines.slice(-3).map((l) => l.trim()), ['dois', 'tres', 'quatro']);
  app.update(0, 2000);
  assert.ok(!/quatro/.test(text()));
});

test('todas as telas cabem em 80×24 com rodapé de ajuda na posição fixa', () => {
  const s = newState();
  s.techs = { t_solar: true, t_hydro: true, t_gas: true, t_nuclear: true, t_fusion: true };
  s.labs = 1; s.totalEnergy = 1e6; s.owned.wind = 9; s.money = 1.23e15; s.t = 400000;
  const { app, press } = make({
    slots: { 1: { status: 'ok', savedAt: 0, state: s }, 2: { status: 'corrupt' }, 3: { ...saved(5), status: 'recovered' } },
    settings: { lastSlot: 1 },
    now: 3 * 86400 * 1000,
  });
  const check = (label) => {
    const lines = app.lines(80, 24);
    assert.equal(lines.length, 24, label);
    for (const l of lines) assert.ok(visibleLength(l) <= 80, `${label}: linha larga demais: ${stripAnsi(l)}`);
    assert.ok(/Q sair|Esc|qualquer tecla|S confirmar/.test(stripAnsi(lines[20])), `${label}: ajuda fora do lugar`);
  };
  check('menu');
  press('5'); check('opções do menu'); press('escape');
  press('3'); check('slots'); press('delete'); check('slots confirmando'); press('n', 'escape');
  press('1'); check('offline'); press('enter');
  for (const t of TABS) { press(t.key); check(t.id); }
});

test('terminal pequeno mostra o aviso em qualquer modo', () => {
  const { app } = make();
  assert.match(stripAnsi(app.lines(70, 20).join('\n')), /Terminal pequeno demais/);
});

test('aba Geradores com as 10 fontes + lab cabe em 80×24 (com rolagem se preciso)', () => {
  const s = newState();
  for (const t of ['t_solar', 't_hydro', 't_biomass', 't_gas', 't_geo', 't_nuclear', 't_tidal', 't_fusion', 't_antimatter']) s.techs[t] = true;
  for (const id of Object.keys(s.owned)) s.owned[id] = 123;
  s.labs = 50; s.totalEnergy = 1e30; s.money = 1e30; s.rp = 1e9;
  const { app, press } = make({ slots: { 1: { status: 'ok', savedAt: null, state: s } } });
  press('1');
  for (const [cols, rows] of [[80, 24], [80, 30], [120, 40]]) {
    const lines = app.lines(cols, rows);
    assert.equal(lines.length, rows);
    for (const l of lines) assert.ok(visibleLength(l) <= cols, `linha larga demais: ${stripAnsi(l)}`);
    const txt = lines.map(stripAnsi).join('\n');
    assert.match(txt, /Turbina Eólica/);
    assert.match(txt, /Q sair/);
  }
  for (let i = 0; i < 11; i++) press('down'); // seleção desce até o lab, rolando a lista
  assert.match(stripAnsi(app.lines(80, 24).join('\n')), /› \[ \] Laboratório/);
});

test('Geradores: B alterna x1/x10/x100/MAX e Enter compra o lote', () => {
  const { app, press, text } = make();
  startNew(press);
  app.state.money = 1e6;
  assert.match(text(), /custo x1 /);
  press('b');
  assert.match(text(), /custo x10/);
  press('enter');
  assert.equal(app.state.owned.wind, 10);
  assert.match(text(), /Comprou 10× Turbina Eólica/);
  press('b', 'b');
  assert.match(text(), /custo MAX/);
  press('1');
  assert.ok(app.state.owned.wind > 25);
  assert.match(text(), /Marco! 25× Turbina Eólica/);
  press('b');
  assert.match(text(), /custo x1 /); // volta ao início
});

test('Geradores: painel mostra próximo marco e U compra upgrade', () => {
  const { app, press, text } = make();
  startNew(press);
  assert.match(text(), /compre 1 unidade para liberar/);
  app.state.money = 165;
  press('enter'); // 1 turbina por $15
  assert.match(text(), /próximo marco 1\/25 → x2/);
  assert.match(text(), /\[U\] nv 1\/5 Pás de Fibra de Vidro — produção x2 — \$150\.0/);
  press('u');
  assert.equal(app.state.upgrades.wind, 1);
  assert.match(text(), /Upgrade: Pás de Fibra de Vidro/);
  press('U');
  assert.match(text(), /Faltam/);
});

test('linha de upgrade cabe em 80 colunas para toda fonte e todo nível', () => {
  const s = newState();
  for (const t of ['t_solar', 't_hydro', 't_biomass', 't_gas', 't_geo', 't_nuclear', 't_tidal', 't_fusion', 't_antimatter']) s.techs[t] = true;
  for (const id of Object.keys(s.owned)) s.owned[id] = 1;
  s.money = 1e30;
  const { app, press } = make({ slots: { 1: { status: 'ok', savedAt: null, state: s } } });
  press('1');
  for (let lvl = 0; lvl <= 5; lvl++) {
    for (const id of Object.keys(s.upgrades)) app.state.upgrades[id] = lvl;
    for (let i = 0; i < 11; i++) {
      for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, `nível ${lvl}: ${stripAnsi(l)}`);
      press('down');
    }
    for (let i = 0; i < 11; i++) press('up');
  }
});

test('cabeçalho mostra uso da rede; Geradores: A liga/desliga a auto-compra', () => {
  const { app, press, text } = make();
  startNew(press);
  assert.match(text(), /Rede 0%/);
  press('a');
  assert.match(text(), /requer a pesquisa Automação Industrial/);
  app.state.techs.t_lab = true;
  app.state.rp = 1000;
  press('p');
  for (let i = 0; i < 80; i++) press('down'); // Automação Industrial fica perto do fim
  for (let i = 0; i < 80 && !/› .*Automação Industrial/.test(text()); i++) press('up');
  press('enter');
  assert.equal(app.state.techs.t_auto, true);
  assert.equal(app.state.auto.buy, true); // já começa ligada
  assert.match(text(), /⟳ auto/);
  press('g');
  assert.match(text(), /Auto-compra ligada · 1 a cada 1 s/);
  app.state.money = 100;
  app.update(1.05, 1050);
  assert.equal(app.state.owned.wind, 1); // comprou sozinho
  press('A');
  assert.equal(app.state.auto.buy, false);
  assert.match(text(), /Auto-compra desligada/);
});

test('árvore de pesquisa completa cabe em 80 colunas em qualquer posição', () => {
  const { app, press } = make();
  startNew(press);
  press('p');
  app.state.rp = 5;
  for (let i = 0; i < 60; i++) { // passa por toda a árvore, Fronteira incluída
    for (const l of app.lines(80, 24)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
    press('down');
  }
});

test('barra de abas: K abre o Mercado; o título encolhe para caber em 80 colunas', () => {
  const { app, press } = make();
  startNew(press);
  press('k');
  assert.equal(app.tab, 'market');
  const at = (cols) => stripAnsi(app.lines(cols, 24)[0]);
  assert.match(at(100), /⚡ ELDEN GRID .*Mercado/);
  assert.doesNotMatch(at(80), /ELDEN GRID/);
  for (const t of TABS) assert.ok(at(80).includes(t.label), `${t.label} cabe inteiro em 80 colunas`);
  for (const t of TABS) { press(t.key); assert.ok(visibleLength(app.lines(80, 24)[0]) <= 80, t.id); }
  press('k');
  assert.match(stripAnsi(app.lines(80, 24).join('\n')), /Mercado  preço \$/);
});

test('cabeçalho lotado (legado enorme, auto, usinas gastas, surto) cabe em 80 colunas', () => {
  const s = newState();
  s.owned.wind = 500;
  s.auto.buy = true;
  s.legacy.points = 123456;
  s.rp = 1.23e15;
  s.money = 1.23e30;
  s.wear.level.wind = 1;
  s.wear.broken.push({ gen: 'wind', at: 0 });
  s.market.surgeUntil = 1e9;
  s.events.next = 1e9;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  const lines = app.lines(80, 24);
  for (const l of lines.slice(0, 4)) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
  assert.match(stripAnsi(lines[2]), /Usinas \d+%/, 'o aviso das usinas fica');
  assert.match(stripAnsi(app.lines(140, 24)[2]), /✦ \+1\.23M%.*⟳ auto/, 'com espaço, tudo aparece');
});

test('Kardashev: fórmula de Sagan, no cabeçalho a partir de K 0 e o recorde nas estatísticas', async () => {
  const { kardashev } = await import('../src/core/engine.js');
  assert.equal(kardashev(1e3), 0, '1 MW = K 0');
  assert.ok(Math.abs(kardashev(1e13) - 1) < 1e-12, 'Tipo I');
  assert.ok(Math.abs(kardashev(1e23) - 2) < 1e-12);
  assert.equal(kardashev(0), -Infinity);
  const s = newState();
  s.owned.wind = 5;
  s.events.next = 1e9;
  const slots = { 1: { status: 'ok', savedAt: null, state: s } };
  const store = { list: () => [1, 2, 3].map((n) => ({ slot: n, ...(slots[n] ?? { status: 'empty' }) })), load: (n) => slots[n], save: () => true, remove() {} };
  const app = createApp({ store, now: 0 });
  app.key('1');
  assert.doesNotMatch(stripAnsi(app.lines(80, 24)[1]), / K-?\d/, 'abaixo de 1 MW não aparece');
  s.techs.t_nuclear = true;
  s.owned.nuclear = 100;
  assert.match(stripAnsi(app.lines(80, 24)[1]), /kW K0\.\d\d/);
  assert.ok(visibleLength(app.lines(80, 24)[1]) <= 80);
  s.career.peakKw = 2e10;
  app.key('e');
  for (let i = 0; i < 30 && !/Maior Kardashev/.test(stripAnsi(app.lines(80, 24).join('\n'))); i++) app.key('down');
  assert.match(stripAnsi(app.lines(80, 24).join('\n')), /Maior Kardashev .*K 0\.73 \(humanidade\)/);
});
