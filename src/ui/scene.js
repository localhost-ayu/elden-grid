// Cena das usinas: um card por tipo de fonte comprada (arte animada + quantidade +
// nível de upgrade), em vez de uma arte por unidade, que não caberia na tela.
import { GENERATORS, LAB } from '../data/generators.js';
import { HEAT } from '../data/heat.js';
import { genEnv, genLaunch, feedFactor, upgradeLevel, upgradeTrack } from '../core/engine.js';
import { sunLevel, reservoirLevel, tideLevel, lunarIsDay } from '../core/traits.js';
import { heatLevel, isHot, isShutdown } from '../core/heat.js';
import { ART, ART_W, ART_H } from './art/index.js';
import { C, paint, GEN_COLOR } from './theme.js';
import { frame } from './anim.js';

export const CARD_H = ART_H + 2;
const CARD_W = ART_W + 1;

const trait = (g, type) => g.traits.find((t) => t.type === type);

function artInfo(s, g) {
  const res = trait(g, 'reservoir');
  const tide = trait(g, 'tide');
  return {
    sun: sunLevel(s),
    level: res ? reservoirLevel(s, res) : 0.5,
    high: tide ? tideLevel(s, tide) >= 1 : true,
    launch: !!genLaunch(s, g)?.open,
    fed: feedFactor(s, g),
    surge: trait(g, 'vacuum') ? genEnv(s, g) : 1,
    day: trait(g, 'lunarDay') ? lunarIsDay(s, trait(g, 'lunarDay')) : true,
    arriving: trait(g, 'haul') ? genEnv(s, g) > 1 : false,
  };
}

// A animação mostra o estado da usina: a eólica gira com o vento e os reatores pulsam
// mais rápido quanto mais quentes estão.
function speed(s, g) {
  if (trait(g, 'wind')) return genEnv(s, g);
  if (isHot(g)) return 1 + 2 * heatLevel(s, g);
  return 1;
}

function artColor(s, g) {
  if (isShutdown(s, g)) return C.dim + C.red;
  if (isHot(g)) {
    const h = heatLevel(s, g);
    if (h > HEAT.warnAt) return C.red + C.bold;
    if (h > 0.6) return C.yellow;
  }
  if (trait(g, 'daylight') && sunLevel(s) === 0) return C.dim + GEN_COLOR[g.id];
  return GEN_COLOR[g.id];
}

const spread = (left, right) => left + ' '.repeat(Math.max(1, ART_W - left.length - right.length)) + right;

// `page` (opcional) limita às fontes daquela página da aba Geradores; o laboratório
// aparece em todas.
export function sceneCards(s, page = null) {
  const cards = GENERATORS.filter((g) => s.owned[g.id] > 0 && (page === null || g.page === page)).map((g) => ({ g }));
  if (s.labs > 0) cards.push({ lab: true });
  return cards;
}

function cardLines(s, card, i, now) {
  if (card.lab) {
    const art = ART.lab.draw(frame(now, ART.lab.fps) + i);
    return [...art.map((l) => paint(C.mag, l)), paint(C.bold + C.mag, LAB.name.padEnd(ART_W)), paint(C.dim, `x${s.labs}`.padEnd(ART_W))];
  }
  const g = card.g;
  const off = isShutdown(s, g);
  const mod = ART[g.art];
  // +i desincroniza cards vizinhos; desligado, o reator congela no primeiro quadro.
  const f = off ? 0 : frame(now, mod.fps * speed(s, g)) + i;
  const art = mod.draw(f, artInfo(s, g));
  const color = artColor(s, g);
  const lvl = upgradeLevel(s, g);
  const stats = off
    ? paint(C.red + C.bold, spread(`x${s.owned[g.id]}`, 'DESLIG.'))
    : paint(C.dim, spread(`x${s.owned[g.id]}`, lvl ? `nv${lvl}/${upgradeTrack(g).length}` : ''));
  return [...art.map((l) => paint(color, l)), paint(C.bold + GEN_COLOR[g.id], g.short.padEnd(ART_W)), stats];
}

function moreCard(n) {
  const lines = Array(CARD_H).fill(' '.repeat(ART_W));
  lines[Math.floor(ART_H / 2)] = paint(C.dim, `+${n} fontes`.padStart(9).padEnd(ART_W));
  return lines;
}

// Até `maxRows` fileiras de cards na largura dada. Se não couber tudo, o último card
// vira "+N fontes" para o jogador saber que há mais (V abre a cena inteira).
export function sceneRows(s, now, width, maxRows, page = null) {
  const cards = sceneCards(s, page);
  if (!cards.length || maxRows < 1) return [];
  const perRow = Math.max(1, Math.floor((width - 1) / CARD_W));
  const room = perRow * maxRows;
  const shown = cards.length > room ? cards.slice(0, room - 1) : cards;
  const blocks = shown.map((c, i) => cardLines(s, c, i, now));
  if (shown.length < cards.length) blocks.push(moreCard(cards.length - shown.length));
  const out = [];
  for (let r = 0; r < blocks.length; r += perRow) {
    const row = blocks.slice(r, r + perRow);
    for (let l = 0; l < CARD_H; l++) out.push(' ' + row.map((b) => b[l]).join(' '));
  }
  return out;
}
