// Novidades (menu): o CHANGELOG.md da 1.0 até a versão atual, com rolagem. ↑↓ PgUp PgDn
// rolam, ←→ pulam de versão, Esc volta. O Markdown vira texto de terminal: títulos de
// versão em destaque, seções coloridas, itens com marcador e quebra de linha na largura.
import { C, paint, glyphs } from '../theme.js';
import { visibleLength } from '../format.js';

export const help = '↑↓ PgUp PgDn rolar  ←→ versão  Esc volta  Q sair';

const clean = (text) => text.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// Quebra `text` em linhas de até `width` colunas; as seguintes começam com `indent`.
function wrap(text, width, first, indent) {
  const out = [];
  let line = first;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (visibleLength(line) + word.length + 1 > width && line.trim()) {
      out.push(line);
      line = indent;
    }
    line += (line.trim() ? ' ' : '') + word;
  }
  if (line.trim()) out.push(line);
  return out;
}

// Linhas prontas para a tela e o índice de cada versão (para ←→).
export function parseChangelog(md, width) {
  const lines = [];
  const versions = [];
  let para = null; // { text, first, indent }
  const flush = () => {
    if (!para) return;
    lines.push(...wrap(clean(para.text), width, para.first, para.indent).map((l) => para.style ? paint(para.style, l) : l));
    para = null;
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (/^\[[^\]]+\]:\s/.test(line) || /^# /.test(line)) continue; // links de comparação e o título
    const ver = line.match(/^## \[([^\]]+)\](?: - (\d{4})-(\d{2})-(\d{2}))?/);
    if (ver) {
      flush();
      if (lines.length) lines.push('');
      versions.push(lines.length);
      const date = ver[2] ? `  ${ver[4]}/${ver[3]}/${ver[2]}` : '';
      lines.push(paint(C.bold + C.yellow, `${glyphs().legacy} ${ver[1]}`) + paint(C.dim, date));
      continue;
    }
    const sec = line.match(/^### (.+)/);
    if (sec) { flush(); lines.push(paint(C.bold + C.cyan, `  ${sec[1]}`)); continue; }
    const item = line.match(/^(\s*)- (.+)/);
    if (item) {
      flush();
      const deep = item[1].length >= 2;
      para = { text: item[2], first: deep ? '      -' : '    •', indent: deep ? '        ' : '      ' };
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (para) para.text += ' ' + line.trim();
    else para = { text: line.trim(), first: '  ', indent: '  ', style: versions.length ? '' : C.dim };
  }
  flush();
  return { lines, versions };
}

const cache = { md: null, width: 0, parsed: null };
function parsed(ctx, width) {
  const md = ctx.changelog;
  if (cache.md !== md || cache.width !== width) Object.assign(cache, { md, width, parsed: md ? parseChangelog(md, width) : null });
  return cache.parsed;
}

export function render(ctx, height = 20, width = 80) {
  const p = parsed(ctx, width - 4);
  if (!p) return ['', paint(C.dim, '   O CHANGELOG.md não foi encontrado junto do jogo.')];
  const ui = ctx.ui;
  const view = Math.max(1, height - 1);
  ui.top = Math.max(0, Math.min(ui.top ?? 0, p.lines.length - view));
  const at = p.versions.filter((v) => v <= ui.top + 1).length;
  const head = '   ' + paint(C.bold, 'Novidades') + paint(C.dim, `  ·  ${p.versions.length} versões  ·  ${Math.min(at + 1, p.versions.length)}ª de cima  ·  linha ${ui.top + 1}/${p.lines.length}`);
  return [head, ...p.lines.slice(ui.top, ui.top + view).map((l) => ' ' + l)];
}

export function key(ctx, k) {
  const ui = ctx.ui;
  const p = parsed(ctx, cache.width || 76); // tecla antes do 1º quadro: usa a largura padrão
  if (!p) return false;
  const step = { up: -1, down: 1, pageup: -10, pagedown: 10 }[k];
  if (step) { ui.top = Math.max(0, (ui.top ?? 0) + step); return true; }
  if (k === 'right') { ui.top = p.versions.find((v) => v > (ui.top ?? 0)) ?? ui.top; return true; }
  if (k === 'left') { ui.top = [...p.versions].reverse().find((v) => v < (ui.top ?? 0)) ?? 0; return true; }
  if (k === 'home') { ui.top = 0; return true; }
  return false;
}
