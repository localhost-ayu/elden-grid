// Visão Império da aba Legado (tecla I): colonizar o próximo capítulo, Patentes,
// colônias e a árvore de Patentes. A colonização apaga o legado, então só acontece com
// confirmação S/N, como a ascensão.
import { PATENT_TREE, COLONY } from '../../data/empire.js';
import { chapterDef } from '../../data/chapters.js';
import { colonizeStatus, canColonize, colonize, nextChapter, patentGain, treeLevel, nextTreeCost, buyPatent } from '../../core/empire.js';
import { kardashev, power } from '../../core/engine.js';
import { C, paint, glyphs } from '../theme.js';
import { fmt } from '../format.js';

export const help = 'I volta ao Legado  ↑↓ Enter compra  C coloniza  espaço gira  Q sair';

const EFFECT = {
  capital: (v) => `começa com ${v >= 3600 ? `${v / 3600} h` : `${v / 60} min`} de renda`,
  founder: (v) => `chega com ${v} pontos de legado`,
  archive: (v) => `pesquisas ${Math.round((1 - v) * 100)}% mais baratas`,
  autoregion: () => 'expande as regiões sozinho',
  imperial: (v) => `produção x${v}`,
};

const patents = (n) => (n < 100 ? n.toFixed(1) : fmt(n));

export function render(ctx) {
  const s = ctx.state;
  const ui = ctx.ui;
  const e = s.empire;
  const ch = chapterDef(s.chapter);
  const k = kardashev(power(s));
  const colonies = e.colonies.length
    ? e.colonies.map((c) => chapterDef(c.chapter).name).join(', ') + paint(C.dim, ` (x${COLONY.mult ** e.colonies.length}, +${e.colonies.length * COLONY.perHour} Patente/h)`)
    : paint(C.dim, 'nenhuma ainda');
  const lines = [
    '   ' + paint(C.bold + C.yellow, `Império · ${ch.name}`) + paint(C.dim, ` (Kardashev ${ch.from} → ${ch.to}, agora ${k >= 0 ? k.toFixed(2) : '< 0'})`) +
      '  ' + paint(C.cyan, `Patentes ${patents(e.patents)}`),
    '   ' + paint(C.dim, 'Colônias: ') + colonies,
    '',
  ];
  const next = nextChapter(s);
  if (!next) {
    lines.push('   ' + paint(C.green, 'Último capítulo: chegue ao Núcleo Galáctico e ao Tipo III.'));
  } else {
    lines.push('   ' + paint(C.bold, `Colonizar: ${next.name}`) + paint(C.dim, `  (Kardashev ${next.from} → ${next.to})`));
    for (const c of colonizeStatus(s)) lines.push('     ' + paint(c.done ? C.green : C.dim, `${c.done ? glyphs().dot : glyphs().dotEmpty} ${c.label}`));
    lines.push('     ' + (canColonize(s)
      ? paint(C.yellow + C.bold, `[C] colonizar: +${patentGain(s)} Patentes; o legado e a partida recomeçam`)
      : paint(C.dim, `[C] colonizar quando tudo acima estiver feito (+${patentGain(s)} Patentes hoje)`)));
  }
  // A pergunta da colonização fica logo abaixo do checklist (sempre à vista).
  if (ui.confirm) lines.push('     ' + paint(C.yellow + C.bold, ui.confirm.text) + '  ' + paint(C.bold, '(S/N)'));
  lines.push('', '   ' + paint(C.bold, 'Árvore de Patentes') + paint(C.dim, '  vale em todos os capítulos'));
  ui.patentSel = Math.max(0, Math.min(ui.patentSel ?? 0, PATENT_TREE.length - 1));
  PATENT_TREE.forEach((item, i) => {
    const lvl = treeLevel(s, item);
    const cost = nextTreeCost(s, item);
    const max = item.costs.length;
    const effect = EFFECT[item.type](item.values[cost == null ? max - 1 : lvl]);
    const price = cost == null ? 'completo ✓' : `${cost} Patentes`;
    const sel = i === ui.patentSel;
    const text = `${sel ? '›' : ' '} ${item.name.padEnd(21)} ${`${lvl}/${max}`.padStart(3)}  ${effect.padEnd(34)} ${price.padStart(11)}`;
    const style = cost == null ? C.dim + C.green : e.patents >= cost ? C.yellow : C.dim;
    lines.push(' ' + paint(style + (sel ? C.bold : ''), text.slice(0, 79)));
  });
  return lines;
}

export function key(ctx, k) {
  const s = ctx.state;
  const ui = ctx.ui;
  if (k === 'up') { ui.patentSel = Math.max(0, (ui.patentSel ?? 0) - 1); return true; }
  if (k === 'down') { ui.patentSel = Math.min(PATENT_TREE.length - 1, (ui.patentSel ?? 0) + 1); return true; }
  if (k === 'enter') {
    const item = PATENT_TREE[ui.patentSel ?? 0];
    const cost = nextTreeCost(s, item);
    if (cost == null) ctx.say(`${item.name}: completo.`, 'info');
    else if (buyPatent(s, item.id)) ctx.say(`Patente: ${item.name} nível ${treeLevel(s, item)}.`, 'ok');
    else ctx.say(`Faltam ${(cost - s.empire.patents).toFixed(1)} Patentes para ${item.name}.`, 'err');
    return true;
  }
  if (k === 'c' || k === 'C') {
    const next = nextChapter(s);
    if (!next) { ctx.say('Este é o último capítulo.', 'info'); return true; }
    if (!canColonize(s)) { ctx.say(`Para colonizar ${next.name}: ${colonizeStatus(s).filter((c) => !c.done).map((c) => c.label).join(' e ')}.`, 'info'); return true; }
    ui.confirm = {
      text: `Colonizar ${next.name}? Legado e partida recomeçam.`,
      run: () => {
        const r = colonize(s);
        ctx.ascended();
        ctx.say(`Colonização: ${r.chapter}! +${r.patents} Patentes. Uma nova escala começa.`, 'ok', 10000);
        if (r.inherited) ctx.say('Herança da Fronteira: o que você tinha do Enxame e do Kugelblitz voltou.', 'ok', 10000);
      },
    };
    return true;
  }
  return false;
}
