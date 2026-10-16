// Mesma tela no menu e na aba O. Cada opção vale na hora (sem "aplicar"), e ←/→ ou
// Enter percorrem os valores; os dois últimos itens são ações sobre o save.
import { CHOICES } from '../../storage/settings.js';
import { C, paint } from '../theme.js';

export const confirmHelp = 'S confirmar  N/Esc cancelar';
export const help = (ctx) => (ctx.ui.confirm ? confirmHelp : '↑↓ escolher  ←→/Enter mudar  \\ disfarce  Esc voltar  Q sair');

const OPTIONS = [
  {
    key: 'animations', label: 'Animações',
    name: { on: 'ligadas', reduced: 'reduzidas', off: 'desligadas' },
    hint: 'reduzidas: sem partículas e mais lentas · desligadas: tudo parado',
  },
  { key: 'fps', label: 'Quadros por segundo', name: (v) => `${v} fps`, hint: 'menos quadros = menos CPU e menos bytes (SSH)' },
  {
    key: 'unicode', label: 'Símbolos',
    name: { true: 'Unicode  ─ █ ▲ ✓', false: 'ASCII puro  - # ^ v' },
    hint: 'ASCII para terminais ou fontes sem blocos e box drawing',
  },
  {
    key: 'colors', label: 'Cores',
    name: { full: 'completas (256)', 16: '16 cores', none: 'sem cor' },
    hint: '16 cores para terminais antigos; NO_COLOR no ambiente força "sem cor"',
  },
  {
    key: 'numbers', label: 'Números',
    name: { short: 'curtos (1.23M)', sci: 'científicos (1.23e6)' },
    hint: 'sufixos k, M, B, T... ou notação científica desde 1000',
  },
  { key: 'autosaveSec', label: 'Autosave', name: (v) => `a cada ${v} s`, hint: 'o jogo também salva ao sair e ao voltar ao menu' },
  {
    key: 'disguise', label: 'Disfarce',
    name: { build: 'testes rodando', logs: 'log de servidor', shell: 'terminal vazio' },
    hint: '\\ (barra invertida) esconde o jogo de qualquer tela; \\ de novo volta',
  },
  {
    key: 'updateCheck', label: 'Checar atualizações',
    name: { true: 'ligado (1x por dia)', false: 'desligado' },
    hint: 'procura versão nova no GitHub, 1x por dia; sem internet, nada muda',
  },
];

const ACTIONS = [
  { id: 'export', label: 'Exportar save' },
  { id: 'import', label: 'Importar save' },
];
const COUNT = OPTIONS.length + ACTIONS.length;

const valueName = (opt, v) => (typeof opt.name === 'function' ? opt.name(v) : opt.name[String(v)]);

export function render(ctx) {
  const ui = ctx.ui;
  ui.sel = Math.max(0, Math.min(ui.sel ?? 0, COUNT - 1));
  ui.importSlot ??= ctx.currentSlot ?? 1;
  const settings = ctx.settings;
  const version = !ctx.version ? '' : ctx.hasUpdate ? `  ·  v${ctx.version} (nova: ${ctx.latestVersion})` : `  ·  v${ctx.version}`;
  // Sem linha em branco no topo: na aba (15 linhas em 80×24) cada linha conta.
  const lines = ['   ' + paint(C.bold, 'Opções') + paint(C.dim, `  (valem na hora; ficam em ~/.elden-grid/settings.json)${version}`), ''];
  OPTIONS.forEach((opt, i) => {
    const selected = ui.sel === i;
    const locked = opt.key === 'colors' && ctx.noColor;
    const value = locked ? 'sem cor (NO_COLOR)' : valueName(opt, settings[opt.key]);
    const arrows = selected && !locked ? paint(C.yellow, '‹ ') + paint(C.bold + C.yellow, value) + paint(C.yellow, ' ›') : `  ${value}`;
    lines.push(`   ${selected ? '›' : ' '} ${opt.label.padEnd(22)}${arrows}`);
  });
  lines.push('');
  const slot = ctx.currentSlot ?? ctx.lastSlot;
  ACTIONS.forEach((a, j) => {
    const selected = ui.sel === OPTIONS.length + j;
    const detail = a.id === 'export'
      ? (slot ? `slot ${slot} → ~/.elden-grid/export-slot${slot}.txt` : 'nenhum save aberto')
      : `~/.elden-grid/import.txt → ${selected ? paint(C.yellow, '‹ ') : ''}slot ${ui.importSlot}${selected ? paint(C.yellow, ' ›') : ''}`;
    lines.push(`   ${selected ? '›' : ' '} ${(a.label).padEnd(22)}${paint(selected ? C.bold : C.dim, detail)}`);
  });
  const sel = OPTIONS[ui.sel];
  // A pergunta S/N ocupa o lugar da dica: na aba (15 linhas em 80×24) não cabem as duas.
  if (ui.confirm) lines.push('', '   ' + paint(C.yellow + C.bold, ui.confirm.text) + '  ' + paint(C.bold, '(S/N)'));
  else {
    lines.push('', paint(C.dim, '   ' + (sel ? sel.hint
      : ui.sel === OPTIONS.length ? 'Enter grava o arquivo e copia o texto (se o terminal permitir copiar)'
      : 'cole o texto do save em import.txt; ←→ escolhe o slot, Enter importa')));
  }
  return lines;
}

function cycle(ctx, opt, dir) {
  if (opt.key === 'colors' && ctx.noColor) {
    ctx.say('NO_COLOR está definido no ambiente: o jogo fica sem cor.', 'info');
    return;
  }
  const order = CHOICES[opt.key];
  const i = order.indexOf(ctx.settings[opt.key]);
  ctx.setSetting(opt.key, order[(i + dir + order.length) % order.length]);
}

export function key(ctx, k) {
  const ui = ctx.ui;
  if (ui.confirm) {
    if (k === 's' || k === 'S') { const { run } = ui.confirm; ui.confirm = null; run(); }
    else if (k === 'n' || k === 'N' || k === 'escape') ui.confirm = null;
    return true;
  }
  if (k === 'up') { ui.sel = Math.max(0, (ui.sel ?? 0) - 1); return true; }
  if (k === 'down') { ui.sel = Math.min(COUNT - 1, (ui.sel ?? 0) + 1); return true; }
  const opt = OPTIONS[ui.sel ?? 0];
  const dir = k === 'left' ? -1 : k === 'right' || k === 'enter' ? 1 : 0;
  if (!dir) return false;
  if (opt) { cycle(ctx, opt, dir); return true; }
  const action = ACTIONS[(ui.sel ?? 0) - OPTIONS.length];
  if (action.id === 'import' && k !== 'enter') {
    ui.importSlot = ((ui.importSlot ?? 1) - 1 + dir + 3) % 3 + 1;
    return true;
  }
  if (k !== 'enter') return true;
  if (action.id === 'export') {
    const r = ctx.exportSave();
    if (!r) ctx.say('Nenhum save para exportar ainda.', 'err');
    else ctx.say(`Save exportado (${r.text.length} caracteres) em ${r.path}${r.copied ? ' e copiado' : ''}.`, 'ok', 8000);
    return true;
  }
  const n = ui.importSlot;
  ui.confirm = {
    text: `Importar import.txt para o slot ${n}? O que estiver nele será substituído.`,
    run: () => {
      const r = ctx.importSave(n);
      ctx.say(r.ok ? `Save importado para o slot ${n}.` : `Não importou: ${r.reason}.`, r.ok ? 'ok' : 'err', 8000);
    },
  };
  return true;
}
