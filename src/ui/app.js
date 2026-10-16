// Roteador de telas. Não toca o terminal: recebe nomes de tecla (input.js) e devolve
// linhas (para o screen.js), por isso dá para testar sem TTY.
import { newState } from '../core/state.js';
import { tick, power, price, priceBase, priceRising, income, rpRate, applyOffline, gridLoad } from '../core/engine.js';
import { autoStep } from '../core/automation.js';
import { createHistory, sampleHistory } from '../core/stats.js';
import { GENERATORS } from '../data/generators.js';
import { crank } from '../core/actions.js';
import { canAscend, legacyMult } from '../core/prestige.js';
import { hourOfDay, isDay } from '../core/traits.js';
import { C, paint, glyphs, setColorMode, setUnicode } from './theme.js';
import { createParticles, easeTo, spawn, stepParticles } from './anim.js';
import { fmt, fmtPct, fmtClock, visibleLength, setNumberFormat } from './format.js';
import { REWARD } from '../data/events.js';
import { eventDef, isActive } from '../core/events.js';
import { eventsStep, currentEvent, holdEvents } from '../core/incidents.js';
import { checkAchievements } from '../core/achievements.js';
import { ACHIEVEMENT_BONUS } from '../data/achievements.js';
import { STEALTH_KEY, createDisguise, stepDisguise, disguiseKey, renderDisguise } from './stealth.js';
import * as crisis from './screens/crisis.js';
import * as menu from './screens/menu.js';
import * as generators from './screens/generators.js';
import * as research from './screens/research.js';
import * as grid from './screens/grid.js';
import * as legacy from './screens/legacy.js';
import * as stats from './screens/stats.js';
import * as slots from './screens/slots.js';
import * as offline from './screens/offline.js';
import * as options from './screens/options.js';
import { DEFAULT_SETTINGS } from '../storage/settings.js';
import { tooSmall, renderTooSmall } from './screens/too-small.js';

// A 1ª letra do rótulo é a tecla direta, e é sublinhada na barra de abas.
export const TABS = [
  { id: 'gens', key: 'g', label: 'Geradores', screen: generators },
  { id: 'research', key: 'p', label: 'Pesquisa', screen: research },
  { id: 'grid', key: 'r', label: 'Rede', screen: grid },
  { id: 'legacy', key: 'l', label: 'Legado', screen: legacy },
  { id: 'stats', key: 'e', label: 'Estatísticas', screen: stats },
  { id: 'options', key: 'o', label: 'Opções', screen: options },
];

const MAX_MESSAGES = 3;
const HEADER_H = 4; // abas + 2 linhas de economia + separador (modo jogo)
const kindColor = (kind) => ({ info: C.yellow, ok: C.green, err: C.red })[kind] ?? '';

// Telas de "tela cheia" (fora do jogo): título no cabeçalho, sem abas nem economia.
const FULL = {
  slots: { screen: slots, title: 'Slots' },
  offline: { screen: offline, title: 'Bem-vindo de volta' },
  options: { screen: options, title: 'Opções' },
};

const usable = (sl) => sl.status === 'ok' || sl.status === 'recovered';

// `store` é a ponte com o disco (index.js liga em storage/saves.js; os testes passam
// uma versão em memória):
//   list() -> [{ slot, status, savedAt, state }]   load(n) -> { status, savedAt, state }
//   save(n, state) -> bool                          remove(n)
// `settings` é o objeto de opções; `onSettings(settings)` persiste quando ele muda.
// `noColor`: NO_COLOR no ambiente (vence a opção de cores). `copy(text)`: tenta pôr o
// texto na área de transferência do terminal; retorna se conseguiu. `who`: { user, host }
// do sistema, para o prompt do disfarce parecer o do jogador.
export function createApp({
  store, settings = {}, onSettings = () => {}, onQuit = () => {}, now = Date.now(), rng = Math.random,
  noColor = false, copy = () => false, who = {},
}) {
  const app = {
    state: null,  // jogo aberto (null = nenhum slot carregado ainda)
    slot: null,   // slot do jogo aberto
    mode: 'menu', // 'menu' | 'slots' | 'offline' | 'game' | 'options'
    tab: 0,
    ui: {},       // estado de cada tela (seleção etc.), por id — sobrevive à troca de aba
    messages: [], // [{ text, kind, until }]
    offline: null, // resumo do último progresso offline (tela 'offline')
    slotCache: null, // lista de slots; relida só quando algo muda (não a cada quadro)
    history: createHistory(), // últimos 60 s para os gráficos da aba Rede (só em memória)
    // Valores mostrados no cabeçalho: perseguem os reais em vez de saltar.
    shown: { money: 0, energy: 0 },
    particles: createParticles(),
    saleClock: 0,
    crisisOpen: false, // manual de crise aberto por cima da aba
    // Disfarce ativo: { d (ui/stealth.js), money } — money = saldo ao esconder, para o
    // resumo da volta. Fica por cima de qualquer modo (menu, jogo, opções...).
    stealth: null,
    now,
  };

  const uiFor = (id) => (app.ui[id] ??= {});

  // Completa no próprio objeto (é ele que vai para o disco) o que faltar.
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (settings[k] === undefined) settings[k] = v;
  function applySettings() {
    setColorMode(noColor ? 'none' : settings.colors);
    setUnicode(settings.unicode);
    setNumberFormat(settings.numbers);
  }
  applySettings();
  const animations = () => settings.animations;
  // Relógio das animações: desligadas congelam em 0; reduzidas andam na metade.
  const animClock = () => ({ off: 0, reduced: app.now / 2 })[animations()] ?? app.now;

  function setSetting(k, v) {
    settings[k] = v;
    applySettings();
    onSettings(settings);
  }

  function exportSave() {
    const n = app.slot ?? settings.lastSlot;
    if (!n || !store.exportText) return null;
    save(); // exporta o jogo como está agora, não o último autosave
    const r = store.exportText(n);
    return r && { ...r, copied: copy(r.text) };
  }

  function importSave(n) {
    const r = store.importText ? store.importText(n) : { ok: false, reason: 'indisponível' };
    if (!r.ok) return r;
    dirty();
    // O jogo aberto foi substituído: recarrega do disco, sem salvar o antigo por cima.
    if (n === app.slot) { app.state = null; app.slot = null; loadSlot(n); }
    return r;
  }

  function say(text, kind = 'info', ms = 4000) {
    app.messages.push({ text, kind, until: app.now + ms });
    if (app.messages.length > MAX_MESSAGES) app.messages.shift();
  }

  const slotList = () => (app.slotCache ??= store.list());
  const dirty = () => { app.slotCache = null; };

  function save() {
    if (!app.state || !app.slot) return true;
    const ok = store.save(app.slot, app.state);
    if (!ok) say('Falha ao gravar o save no disco!', 'err', 6000);
    dirty();
    return ok;
  }

  function remember(n) {
    if (settings.lastSlot !== n) { settings.lastSlot = n; onSettings(settings); }
  }

  // Trocar de slot salva o jogo atual antes, para nunca perder progresso.
  function open(n, state) {
    if (app.state && app.slot && app.slot !== n) save();
    app.state = state;
    app.slot = n;
    app.tab = 0;
    app.ui = {};
    app.history = createHistory(); // histórico é do jogo aberto, não do anterior
    // Abrir um save não deve "rolar" do zero até o saldo dele.
    app.shown = { money: state.money, energy: state.totalEnergy };
    app.particles = createParticles();
    app.crisisOpen = false;
    remember(n);
  }

  function loadSlot(n) {
    if (n === app.slot && app.state) { app.mode = 'game'; return; } // já está aberto
    const r = store.load(n);
    if (!usable(r)) { say(`Slot ${n} não pode ser carregado.`, 'err'); return; }
    open(n, r.state);
    if (r.status === 'recovered') say(`Save do slot ${n} estava corrompido: recuperado do backup.`, 'info', 8000);
    // Progresso offline só ao abrir um save do disco (eventos/calor não rodam offline).
    app.offline = r.savedAt != null ? applyOffline(app.state, (app.now - r.savedAt) / 1000) : null;
    app.mode = app.offline ? 'offline' : 'game';
  }

  function newGame(n) {
    open(n, newState(Math.floor(rng() * 2 ** 32)));
    save(); // ocupa o slot já, para aparecer como usado na lista
    app.mode = 'game';
    say(`Novo jogo no slot ${n}! Gire a manivela (espaço) e compre sua primeira turbina.`, 'ok', 6000);
  }

  function deleteSlot(n) {
    store.remove(n);
    dirty();
    // Apagou o slot aberto: fecha o jogo, senão o autosave recriaria o arquivo.
    if (n === app.slot) { app.state = null; app.slot = null; }
    if (settings.lastSlot === n) { settings.lastSlot = null; onSettings(settings); }
    say(`Slot ${n} apagado.`, 'info');
  }

  // "Continuar": jogo aberto, senão o último slot usado, senão o save mais recente.
  function continueTarget() {
    if (app.state) return app.slot;
    const ok = slotList().filter(usable);
    if (ok.some((sl) => sl.slot === settings.lastSlot)) return settings.lastSlot;
    return ok.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0]?.slot ?? null;
  }

  // Contexto entregue às telas: só o que elas precisam, sem acesso ao terminal.
  const ctx = (id) => ({
    get state() { return app.state; },
    get slots() { return slotList(); },
    get canContinue() { return continueTarget() !== null; },
    currentSlot: app.slot,
    offline: app.offline,
    ui: uiFor(id),
    now: app.now,
    anim: animClock(),
    settings,
    setSetting,
    noColor,
    lastSlot: settings.lastSlot,
    exportSave,
    importSave,
    history: app.history,
    say,
    go: (mode) => { app.mode = mode; },
    continueGame: () => loadSlot(continueTarget()),
    openSlots(purpose) {
      app.ui.slots = { purpose, sel: Math.max(0, (app.slot ?? 1) - 1) };
      app.mode = 'slots';
    },
    loadSlot,
    newGame,
    deleteSlot,
    // A partida mudou por inteiro: gráficos e partículas da anterior não fazem sentido.
    ascended() {
      app.history = createHistory();
      app.particles = createParticles();
      save();
    },
    close: () => { app.crisisOpen = false; },
    announce,
    quit: () => onQuit(),
  });

  function toMenu() {
    save();
    app.mode = 'menu';
    uiFor('menu').sel = undefined; // reabre no primeiro item disponível
  }

  function gameKey(k) {
    const tab = TABS[app.tab];
    // Com uma confirmação S/N aberta, a aba decide tudo: "m" ou "q" não podem fugir dela.
    if (app.ui[tab.id]?.confirm) { tab.screen.key(ctx(tab.id), k); return; }
    // O manual de crise fica com todas as teclas (espaço vira jogada, não manivela).
    if (app.crisisOpen) { crisis.key(ctx('crisis'), k); return; }
    if (k === 'x' || k === 'X') {
      if (app.state.events.crisis) { app.crisisOpen = true; app.ui.crisis = {}; }
      else say('Nenhuma crise agora. Quando houver, o aviso aparece no topo.', 'info', 3000);
      return;
    }
    if (k === 'tab') { app.tab = (app.tab + 1) % TABS.length; return; }
    if (k === 'shift-tab') { app.tab = (app.tab - 1 + TABS.length) % TABS.length; return; }
    if (k === 'space') { crankBurst(); return; }
    if (k === 'escape' || k === 'm' || k === 'M') return toMenu();
    if (k === 'q' || k === 'Q') return onQuit();
    const direct = TABS.findIndex((t) => t.key === k.toLowerCase() && k.length === 1);
    if (direct >= 0) { app.tab = direct; return; }
    tab.screen.key(ctx(tab.id), k);
  }

  // A partícula nasce da ação: girar a manivela solta o que ela rendeu.
  function crankBurst() {
    const kwh = crank(app.state);
    if (animations() !== 'on') return;
    const x = 0.5 + rng() * 0.35;
    spawn(app.particles, { text: `+${fmt(kwh)} kWh`, st: C.cyan, x, y: 0, vy: 4, life: 1.6 });
    spawn(app.particles, { text: `+$${fmt(kwh * price(app.state))}`, st: C.green, x: x + 0.12, y: 0, vy: 3, life: 1.6 });
  }

  // Várias de uma vez (um save antigo que já cumpria muitas) viram uma mensagem só.
  function celebrate(list) {
    if (!list.length) return;
    const bonus = `+${Math.round(ACHIEVEMENT_BONUS * 100)}% de produção`;
    if (list.length > 2) say(`★ ${list.length} conquistas desbloqueadas! (${bonus} cada) Veja em Estatísticas, tecla V.`, 'ok', 8000);
    else for (const a of list) say(`★ Conquista: ${a.name} — ${a.desc} (${bonus})`, 'ok', 6000);
  }

  // Notas do core/incidents.js viram mensagens no rodapé.
  function announce(note) {
    if (!note) return;
    const def = eventDef(note.id);
    if (note.type === 'crisis') {
      say(`${glyphs().warn} CRISE: ${def.name} — ${def.desc}. Aperte X para o manual de crise.`, 'err', 10000);
    } else if (note.type === 'start') {
      say(`${def.name}: ${def.desc}${note.rp ? ` (+${fmt(note.rp)} PP)` : ''}.`, 'info', 6000);
    } else if (note.type === 'end') {
      say(note.id === REWARD.id ? `${REWARD.name} acabou.` : `Fim do evento: ${def.name}.`, 'info', 3000);
    } else if (note.type === 'resolved') {
      const cost = `$${fmt(note.cost)}`;
      const the = `${def.article} ${def.name.toLowerCase()}`;
      const solved = def.article === 'o' ? 'resolvido' : 'resolvida';
      const [text, kind] = {
        won: [`${def.name} ${solved} por você! Sem custo + ${REWARD.name} por ${REWARD.duration} s.`, 'ok'],
        lost: [`Não deu: a equipe consertou ${the} por ${cost}.`, 'err'],
        crew: [`Equipe chamada: ${the} foi ${solved} por ${cost}.`, 'info'],
        timeout: [`Ninguém atendeu: a equipe resolveu ${the} sozinha por ${cost}.`, 'err'],
      }[note.outcome];
      say(text, kind, 8000);
    }
  }

  // Esconder salva na hora (se o jogador fechar a janela depois, nada se perde) e não
  // deixa rastro: sem mensagens, partículas ou alerta piscando por baixo do disfarce.
  function toggleStealth() {
    if (app.stealth) {
      const { money } = app.stealth;
      app.stealth = null;
      if (app.state) {
        const diff = app.state.money - money;
        say(`De volta! Enquanto o jogo estava escondido: ${diff >= 0 ? '+' : '-'}$${fmt(Math.abs(diff))}; eventos e crises ficaram em pausa.`, 'ok', 6000);
      }
      return;
    }
    save();
    app.stealth = { d: createDisguise(settings.disguise, { now: app.now, rng, ...who }), money: app.state?.money ?? 0 };
    app.messages = [];
    app.particles = createParticles();
  }

  function key(k) {
    if (k === STEALTH_KEY) return toggleStealth();
    if (k === 'ctrl-c') return onQuit();
    if (app.stealth) return disguiseKey(app.stealth.d, k);
    if (app.mode === 'game') return gameKey(k);
    const screen = app.mode === 'menu' ? menu : FULL[app.mode].screen;
    if (screen.key(ctx(app.mode), k)) return;
    if (k === 'q' || k === 'Q') return onQuit();
    if (k === 'escape' && app.mode !== 'menu') app.mode = 'menu';
  }

  // O jogo aberto continua produzindo em qualquer tela (é um idle game).
  function update(dt, now) {
    app.now = now;
    if (app.state) {
      const shutdowns = tick(app.state, dt);
      autoStep(app.state, dt);
      if (app.stealth) holdEvents(app.state, dt);
      else eventsStep(app.state, dt).forEach(announce);
      if (!app.state.events.crisis) app.crisisOpen = false;
      celebrate(checkAchievements(app.state));
      sampleHistory(app.history, app.state);
      // Animações desligadas: os números saltam direto para o valor real.
      const roll = animations() === 'off' ? (_, target) => target : (cur, target) => easeTo(cur, target, dt);
      app.shown.money = roll(app.shown.money, app.state.money);
      app.shown.energy = roll(app.shown.energy, app.state.totalEnergy);
      // Uma partícula de venda por segundo: o dinheiro entrando fica visível sem poluir.
      app.saleClock += dt;
      if (app.saleClock >= 1) {
        app.saleClock %= 1;
        const inc = income(app.state);
        if (app.mode === 'game' && !app.stealth && inc > 0 && animations() === 'on') {
          spawn(app.particles, { text: `+$${fmt(inc)}`, st: C.green + C.dim, x: 0.45 + rng() * 0.5, y: 0, vy: 4, life: 1.4 });
        }
      }
      for (const id of shutdowns) {
        const g = GENERATORS.find((x) => x.id === id);
        say(`⚠ ${g.name} superaqueceu e desligou! Resfrie na aba Rede (visão Calor).`, 'err', 8000);
      }
    }
    stepParticles(app.particles, dt);
    app.messages = app.messages.filter((m) => m.until > now);
    if (app.stealth) { app.messages = []; stepDisguise(app.stealth.d, now); }
  }

  const sep = (cols) => paint(C.dim, ' ' + '─'.repeat(Math.max(0, cols - 2)));

  // O separador do cabeçalho vira o aviso do evento em andamento, com contagem regressiva.
  // Na crise o ⚠ pisca: é um indicador de estado, o único elemento em loop.
  function banner(cols) {
    const s = app.state;
    const ev = s.events;
    const cur = currentEvent(s);
    const reward = ev.effects.find((a) => a.id === REWARD.id && isActive(s, a));
    if (!cur && !reward) return sep(cols);
    let text;
    let color;
    if (ev.crisis) {
      const def = eventDef(ev.crisis.id);
      const blink = Math.floor(animClock() / 500) % 2 === 0;
      // Sem a descrição: o relógio é o que não pode ser cortado.
      text = `${glyphs().warn} ${def.name.toUpperCase()} · [X] manual de crise · equipe em ${fmtClock(Math.max(0, ev.crisis.deadline - s.t))}`;
      color = C.red + (blink ? C.bold : '');
    } else if (cur) {
      const def = eventDef(cur.id);
      text = `${def.name} · ${def.desc} · ${fmtClock(cur.until - s.t)}`;
      color = C.yellow;
    } else {
      text = `${REWARD.name} · produção x${REWARD.effects[0].mult} · ${fmtClock(reward.until - s.t)}`;
      color = C.green;
    }
    const room = cols - 7;
    if (visibleLength(text) > room) text = [...text].slice(0, room - 1).join('') + '…';
    const rest = Math.max(0, cols - 5 - visibleLength(text) - 1);
    return paint(C.dim, ' ──') + paint(color, ` ${text} `) + paint(C.dim, '─'.repeat(rest));
  }

  function tabBar() {
    const parts = TABS.map((t, i) => {
      const label = paint(C.underline, t.label[0]) + t.label.slice(1);
      // Avisa de qualquer aba que a ascensão ficou disponível.
      const badge = t.id === 'legacy' && canAscend(app.state) ? paint(C.yellow + C.bold, glyphs().legacy) : '';
      return i === app.tab ? paint(C.inverse + C.bold, ` ${t.label} `) + badge : ` ${label}${badge} `;
    });
    return paint(C.bold + C.yellow, ' ⚡ ELDEN GRID') + '  ' + parts.join(paint(C.dim, '│'));
  }

  function statsLines() {
    const s = app.state;
    return [
      ` Dinheiro ${paint(C.green, '$' + fmt(app.shown.money))}  ` +
      `Produção ${paint(C.cyan, fmt(power(s)) + ' kW')}  ` +
      `Total ${paint(C.cyan, fmt(app.shown.energy) + ' kWh')}  ` +
      priceText(s),
      ` Renda ${paint(C.green, '$' + fmt(income(s)) + '/s')}  ` +
      `PP ${paint(C.mag, fmt(s.rp))} ${paint(C.dim, '(+' + fmt(rpRate(s)) + '/s)')}  ` +
      gridText(s) + '  ' +
      // Relógio do jogo (1 s real = 1 h): ☼ de dia, ☾ à noite — o jogador entende o solar.
      paint(isDay(s) ? C.yellow : C.dim, `${isDay(s) ? '☼' : '☾'} ${String(Math.floor(hourOfDay(s))).padStart(2, '0')}h`) +
      (s.auto.buy ? '  ' + paint(C.cyan, '⟳ auto') : '') +
      (s.legacy.points ? '  ' + paint(C.yellow, `${glyphs().legacy} +${Math.round((legacyMult(s) - 1) * 100)}%`) : ''),
    ];
  }

  // Cor: acima (verde) ou abaixo (amarelo) da média; seta: subindo ou descendo agora.
  function priceText(s) {
    const p = price(s);
    const color = p >= priceBase(s) ? C.green : C.yellow;
    return `Preço ${paint(color, '$' + p.toFixed(2) + '/kWh ' + (priceRising(s) ? glyphs().up : glyphs().down))}`;
  }

  // Uso da rede: verde folgada, amarelo perto do limite, vermelho saturada (vendendo
  // excedente com desconto). É o sinal para pesquisar capacidade.
  function gridText(s) {
    const load = gridLoad(s);
    const color = load > 1 ? C.red + C.bold : load > 0.85 ? C.yellow : C.green;
    return 'Rede ' + paint(color, fmtPct(load));
  }

  function messageLines() {
    const shown = app.messages.slice(-MAX_MESSAGES);
    const lines = shown.map((m) => ' ' + paint(kindColor(m.kind), m.text));
    // Linhas vazias em cima: a mensagem mais nova fica sempre na última linha.
    return [...Array(MAX_MESSAGES - lines.length).fill(''), ...lines];
  }

  // Encaixa o corpo na altura exata: corta com aviso ou completa com linhas vazias,
  // para o rodapé nunca "subir" nem sair da tela.
  function fit(body, height) {
    if (body.length > height) {
      body = body.slice(0, Math.max(0, height - 1));
      body.push(paint(C.dim, ' … (aumente a altura do terminal para ver mais)'));
    }
    return [...body, ...Array(Math.max(0, height - body.length)).fill('')];
  }

  // A ajuda de uma tela pode depender do estado dela (ex.: pergunta S/N aberta).
  const helpOf = (screen, c) => (typeof screen.help === 'function' ? screen.help(c) : screen.help);

  function lines(cols, rows) {
    // O disfarce vem antes até do aviso de tela pequena: nada do jogo pode aparecer.
    if (app.stealth) return renderDisguise(app.stealth.d, cols, rows, app.now);
    if (tooSmall(cols, rows)) return renderTooSmall(cols, rows);
    let header;
    let body;
    let help;
    const room = (h) => rows - h.length - 2 - MAX_MESSAGES;
    if (app.mode === 'menu') {
      header = [];
      help = menu.help;
      body = menu.render(ctx('menu'), room(header), cols);
    } else if (app.mode === 'game') {
      header = [tabBar(), ...statsLines(), banner(cols)];
      const tab = app.crisisOpen ? { id: 'crisis', screen: crisis } : TABS[app.tab];
      help = helpOf(tab.screen, ctx(tab.id));
      body = tab.screen.render(ctx(tab.id), room(header), cols);
    } else {
      const f = FULL[app.mode];
      header = [paint(C.bold + C.yellow, ' ⚡ ELDEN GRID') + paint(C.dim, `  ·  ${f.title}`), sep(cols)];
      const c = ctx(app.mode);
      help = c.ui.confirm && f.screen.confirmHelp ? f.screen.confirmHelp : helpOf(f.screen, c);
      body = f.screen.render(c, room(header), cols);
    }
    const footer = [sep(cols), paint(C.dim, ' ' + help), ...messageLines()];
    return [...header, ...fit(body, rows - header.length - footer.length), ...footer];
  }

  // Partículas sobem dentro da região que a aba declara (`ui.particleZone`, em linhas
  // do corpo): a cena das usinas. Fora dela (outras abas, telas cheias) não aparecem,
  // para nunca parecerem parte de um número da interface.
  function overlays(cols, rows) {
    if (app.mode !== 'game' || app.stealth || app.crisisOpen || tooSmall(cols, rows)) return [];
    const zone = app.ui[TABS[app.tab].id]?.particleZone;
    if (!zone) return [];
    const top = HEADER_H + zone.top;
    const bottom = top + zone.height - 1;
    return app.particles.list.flatMap((p) => {
      const row = bottom - Math.floor(p.y);
      if (row < top || row > bottom) return [];
      const col = 1 + Math.floor(Math.max(0, Math.min(1, p.x)) * (cols - 2 - p.text.length));
      const fading = p.age > p.life * 0.6 && !p.st.includes(C.dim);
      return [{ row, col, text: p.text, st: fading ? p.st + C.dim : p.st }];
    });
  }

  return {
    key,
    update,
    lines,
    overlays,
    say,
    save,
    get state() { return app.state; },
    get slot() { return app.slot; },
    get mode() { return app.mode; },
    get hidden() { return app.stealth !== null; },
    get tab() { return TABS[app.tab].id; },
  };
}
