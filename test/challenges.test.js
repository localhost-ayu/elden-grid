// Desafios: regras no core, slot D, meta e perfil. Disco e perfil em memória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES, GOALS } from '../src/data/challenges.js';
import { GENERATORS } from '../src/data/generators.js';
import { rules, applyRunStart, priceDecay, goalReached, NEUTRAL } from '../src/core/challenges.js';
import { power, capacity, upkeep, priceBase, genUnlocked } from '../src/core/engine.js';
import { crank, buyGen } from '../src/core/actions.js';
import { eventsStep } from '../src/core/incidents.js';
import { canAscend } from '../src/core/prestige.js';
import { newState, isValidState } from '../src/core/state.js';
import { newProfile, completeChallenge, challengeTier } from '../src/core/profile.js';
import { createApp } from '../src/ui/app.js';
import { describeRule } from '../src/ui/screens/challenges.js';
import { stripAnsi, visibleLength } from '../src/ui/format.js';

const inRun = (challenge, tier = 1) => {
  const s = newState(7);
  s.run = { challenge, tier };
  applyRunStart(s);
  return s;
};

test('dados: 6 desafios, 5 níveis cada, regra descrita e válida', () => {
  assert.equal(CHALLENGES.length, 6);
  assert.equal(GOALS.length, 5);
  for (const c of CHALLENGES) {
    assert.equal(c.rules.length, 5, c.id);
    for (const r of c.rules) {
      for (const k of Object.keys(r)) assert.ok(k in NEUTRAL, `${c.id}: regra desconhecida ${k}`);
      for (const id of r.disabled ?? []) assert.ok(GENERATORS.some((g) => g.id === id));
      assert.ok(describeRule(r).length > 0);
      assert.ok(visibleLength('   regra: ' + describeRule(r)) <= 80, `${c.id}: ${describeRule(r)}`);
    }
  }
  assert.equal(rules(newState()), NEUTRAL);
});

test('Sem Vento: sem eólica nem manivela, começa com 1 solar já pesquisado', () => {
  const s = inRun('calm');
  assert.equal(s.owned.solar, 1);
  assert.equal(s.techs.t_solar, true);
  const wind = GENERATORS.find((g) => g.id === 'wind');
  assert.equal(genUnlocked(wind, s), false);
  s.money = 1e6;
  assert.equal(buyGen(s, 'wind'), false);
  assert.equal(crank(s), 0);
  assert.equal(s.stats.cranks, 0);
  const tier3 = inRun('calm', 3);
  tier3.techs.t_hydro = true;
  assert.equal(genUnlocked(GENERATORS.find((g) => g.id === 'hydro'), tier3), false);
});

test('Rede Velha, Mercado em Queda e Combustível Caro mudam rede, preço e operação', () => {
  const normal = newState();
  normal.techs = { t_grid: true, t_hv: true };
  const old = inRun('oldgrid', 3);
  old.techs = { ...normal.techs };
  const exp = CHALLENGES.find((c) => c.id === 'oldgrid').rules[2].capacityExp;
  assert.ok(Math.abs(capacity(old) / capacity(normal) - 20 ** exp / 20) < 1e-9);

  const crash = inRun('crash', 1);
  assert.equal(priceDecay(crash), 1);
  const { priceHalfLife, priceFloor } = CHALLENGES.find((c) => c.id === 'crash').rules[0];
  crash.stats.playTime = priceHalfLife;
  assert.ok(Math.abs(priceDecay(crash) - 0.5) < 1e-9);
  crash.stats.playTime = 1e6;
  assert.equal(priceDecay(crash), priceFloor);
  assert.ok(Math.abs(priceBase(crash) - priceFloor) < 1e-9);

  const fuel = inRun('fuel', 5);
  fuel.owned.gas = 2;
  fuel.owned.nuclear = 2;
  const gas = newState();
  gas.owned.gas = 2;
  gas.owned.nuclear = 2;
  const rule = CHALLENGES.find((c) => c.id === 'fuel').rules[4];
  assert.equal(upkeep(fuel), upkeep(gas) * rule.upkeep);
  const nuclear = GENERATORS.find((g) => g.id === 'nuclear');
  assert.ok(Math.abs(power(fuel) / power(gas) - rule.output.nuclear) < 1e-9);
});

test('Apagão Eterno: eventos bem mais frequentes', () => {
  const count = (s) => {
    s.owned.wind = 50;
    s.techs = { t_nuclear: true };
    s.owned.nuclear = 1;
    for (let i = 0; i < 3600; i++) {
      s.t += 1;
      eventsStep(s, 1);
      if (s.events.crisis) eventsStep(Object.assign(s, { t: s.events.crisis.deadline }), 0);
    }
    return s.events.seen;
  };
  const normal = count(newState(7));
  const storm = count(inRun('blackout', 5));
  assert.ok(storm > normal * 2.5, `${storm} vs ${normal}`);
});

test('meta: ganhar GOALS[nível-1] na partida; desafio não ascende', () => {
  const s = inRun('oldgrid', 2);
  s.earned = GOALS[1] - 1;
  assert.equal(goalReached(s), false);
  s.earned = GOALS[1];
  assert.equal(goalReached(s), true);
  assert.equal(canAscend(s), false);
  s.run.done = true;
  assert.equal(goalReached(s), false);
  assert.ok(isValidState(s));
});

// App com disco e perfil em memória.
function make(profile = newProfile()) {
  const data = {};
  const writes = [];
  const store = {
    data,
    list: () => [1, 2, 3].map((n) => ({ slot: n, ...(data[n] ?? { status: 'empty' }) })),
    load: (n) => (data[n] ? { ...data[n], state: structuredClone(data[n].state) } : { status: 'empty' }),
    save: (n, st) => { data[n] = { status: 'ok', savedAt: 0, state: structuredClone(st) }; return true; },
    remove: (n) => { delete data[n]; },
  };
  const app = createApp({ store, now: 0, profile: { read: () => profile, write: (p) => writes.push(structuredClone(p)) } });
  const text = () => app.lines(80, 24).map(stripAnsi).join('\n');
  return { app, store, profile, writes, text, press: (...k) => k.forEach((x) => app.key(x)) };
}

test('menu → Desafios → Enter começa o nível 1 no slot D, sem tocar os slots 1–3', () => {
  const { app, store, press, text } = make();
  press('4');
  assert.equal(app.mode, 'challenges');
  assert.match(text(), /Apagão Eterno .*○○○○○/);
  press('down', 'down', 'enter'); // Rede Velha
  assert.equal(app.mode, 'game');
  assert.equal(app.slot, 'D');
  assert.deepEqual(store.data.D.state.run, { challenge: 'oldgrid', tier: 1 });
  assert.equal(store.data[1], undefined);
  assert.match(text(), /Rede Velha I 0%/);
});

test('só joga até o próximo nível; recordes aparecem na tela', () => {
  const p = newProfile();
  completeChallenge(p, 'blackout', 1, 1900);
  const { app, press, text } = make(p);
  press('4', 'right', 'right', 'right');
  assert.match(text(), /nível ‹ II ›/);
  assert.match(text(), /Complete o nível II para liberar o próximo/);
  assert.match(text(), /recordes: I 32min/);
  press('left', 'enter');
  assert.deepEqual(app.state.run, { challenge: 'blackout', tier: 1 }); // repetir vale recorde
});

test('cumprir a meta conclui o desafio, sobe o perfil e grava; repetir não sobe de novo', () => {
  const { app, profile, writes, store, press, text } = make();
  press('4', 'enter');
  app.state.earned = GOALS[0];
  app.state.stats.playTime = 1500;
  app.update(0.1, 100);
  assert.equal(challengeTier(profile, 'blackout'), 1);
  assert.equal(writes.length, 1);
  assert.equal(store.data.D.state.run.done, true);
  assert.match(text(), /DESAFIO CONCLUÍDO: Apagão Eterno I em 25 min/);
  assert.match(text(), /Apagão Eterno I ✓/);
  app.update(0.1, 200);
  assert.equal(writes.length, 1); // conta uma vez só
});

test('abandonar uma partida em andamento pede confirmação; C continua sem progresso offline', () => {
  const { app, store, press, text } = make();
  press('4', 'enter');
  app.state.money = 777;
  press('escape', '4', 'down', 'enter');
  assert.match(text(), /Abandonar Apagão Eterno I e começar Sem Vento I\?/);
  press('n', 'c');
  assert.equal(app.state.run.challenge, 'blackout');
  assert.equal(app.state.money, 777);
  // Recarregar do disco (outra sessão): sem crédito offline mesmo com savedAt antigo.
  app.save();
  store.data.D.savedAt = -3600 * 1000;
  const fresh = createApp({ store, now: 0 });
  fresh.key('4');
  fresh.key('c');
  assert.equal(fresh.mode, 'game');
  assert.equal(fresh.state.money, 777);
});

test('na partida de desafio: Legado explica que não há ascensão e a manivela avisa quando desligada', () => {
  const { app, press, text } = make();
  press('4', 'down', 'enter'); // Sem Vento
  press('space');
  assert.match(text(), /A manivela está desligada neste desafio/);
  press('l', 'enter');
  assert.match(text(), /Sem ascensão nesta partida/);
  assert.match(text(), /Desafios não têm ascensão/);
});

test('tela de Desafios cabe em 80×24 em qualquer desafio, nível e progresso', () => {
  const p = newProfile();
  for (const c of CHALLENGES) for (let t = 1; t <= 5; t++) completeChallenge(p, c.id, t, 3600 * 9.5);
  for (const profile of [newProfile(), p]) {
    const { app, press } = make(profile);
    press('4');
    for (let i = 0; i < CHALLENGES.length; i++) {
      for (let t = 0; t < 5; t++) {
        const lines = app.lines(80, 24);
        assert.equal(lines.length, 24);
        for (const l of lines) assert.ok(visibleLength(l) <= 80, stripAnsi(l));
        press('right');
      }
      press('down');
    }
  }
});

test('recompensa vale ao voltar para os slots 1–3: jogo novo já traz a solar (Brisa Solar)', () => {
  const { app, press, text } = make();
  press('4', 'down', 'enter'); // Sem Vento I
  app.state.earned = GOALS[0];
  app.update(0.1, 100);
  assert.match(text(), /Nos slots 1–3: produção x1\.1 e \+20% na solar/);
  press('escape', '2', '1'); // Novo jogo no slot 1
  assert.equal(app.slot, 1);
  assert.equal(app.state.techs.t_solar, true);
});

test('semente do dia: tela cabe em 80×24 em qualquer data do ano, com e sem pergunta aberta', async () => {
  const { localDate } = await import('../src/core/challenges.js');
  for (let d = 0; d < 366; d++) {
    const now = Date.UTC(2026, 0, 1, 12) + d * 86400000;
    const fresh = createApp({ store: { list: () => [], load: () => ({ status: 'empty' }), save: () => true, remove() {} }, now });
    fresh.key('4');
    for (let i = 0; i < CHALLENGES.length; i++) fresh.key('down');
    const lines = fresh.lines(80, 24);
    assert.equal(lines.length, 24);
    for (const l of lines) assert.ok(visibleLength(l) <= 80, `${localDate(now)}: ${stripAnsi(l)}`);
    assert.match(stripAnsi(lines.join('\n')), /Semente do dia \d\d\/\d\d:/);
  }
});

test('semente do dia: mesma data = mesma partida e mesma regra; termina com código e recorde', async () => {
  const { dailyChallenges, dailyCode, localDate } = await import('../src/core/challenges.js');
  const now = Date.UTC(2026, 9, 16, 15);
  const date = localDate(now);
  const play = () => {
    const profile = newProfile();
    const data = {};
    const store = {
      list: () => [], remove() {},
      load: (n) => (data[n] ? { status: 'ok', savedAt: 0, state: structuredClone(data[n]) } : { status: 'empty' }),
      save: (n, st) => { data[n] = structuredClone(st); return true; },
    };
    const app = createApp({ store, now, profile: { read: () => profile, write() {} } });
    app.key('4');
    for (let i = 0; i < CHALLENGES.length; i++) app.key('down');
    app.key('enter');
    return { app, profile, text: () => app.lines(80, 24).map(stripAnsi).join('\n') };
  };
  const a = play();
  const b = play();
  assert.equal(a.app.slot, 'D');
  assert.deepEqual(a.app.state.run, { daily: date });
  assert.equal(a.app.state.events.rng, b.app.state.events.rng); // mesma seed
  for (const id of dailyChallenges(date)) for (const k of Object.keys(challengeDefRules(id))) assert.ok(k in rules(a.app.state));
  assert.match(a.text(), new RegExp(`Semente ${date.slice(8, 10)}/${date.slice(5, 7)} 0%`));

  a.app.state.earned = GOALS[0];
  a.app.state.stats.playTime = 2292;
  a.app.update(0.1, now + 100);
  assert.ok(Math.abs(a.profile.daily[date] - 2292.1) < 1e-6); // o quadro somou 0.1 s
  assert.match(a.text(), new RegExp(`Código para os amigos: ${dailyCode(date, 2292.1)}`));
  assert.match(dailyCode(date, 2292), /^EG-1016-38:12-[0-9A-Z]{3}$/);
  // Na tela: recorde e código de hoje.
  a.app.key('escape');
  a.app.key('4');
  for (let i = 0; i < CHALLENGES.length; i++) a.app.key('down');
  assert.match(a.text(), /recorde de hoje: 38min {2}· {2}código: EG-1016-38:12-/);
});

function challengeDefRules(id) {
  return CHALLENGES.find((c) => c.id === id).rules[0];
}
