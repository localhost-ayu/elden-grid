// Império: colonização e colônias. Lê e escreve `s.empire` e reinicia o legado e a
// partida. A árvore de Patentes mora em patents.js; o x das colônias e as Patentes por hora
// ficam no engine (empireMult, tick).
import { COLONIZE, PATENTS } from '../data/empire.js';
import { CHAPTERS, chapterIndex, chapterDef } from '../data/chapters.js';
import { GENERATORS } from '../data/generators.js';
import { REGIONS } from '../data/regions.js';
import { newState } from './state.js';
import { startRun } from './prestige.js';
import { add } from './records.js';
import { power } from './engine.js';
import { patentValue } from './patents.js';

export { treeLevel, nextTreeCost, patentValue, buyPatent } from './patents.js';

export const nextChapter = (s) => CHAPTERS[chapterIndex(s.chapter) + 1] ?? null;
const lastRegion = (s) => s.region >= REGIONS[s.chapter].length - 1;

// Veterano: save da 1.x que já tinha a Fronteira (estoque) ou chegou ao Vácuo alguma vez
// pode colonizar o Sistema Solar direto, sem repetir a Terra.
export const veteran = (s) => s.chapter === 'earth' && (!!s.empire.frontierStash || !!s.achievements.a_vacuum);

// O que falta para colonizar, como checklist (texto + feito).
export function colonizeStatus(s) {
  const need = COLONIZE[s.chapter];
  if (!need || s.run || s.empire.visit) return [];
  if (veteran(s)) return [{ label: 'veterano da Fronteira (1.x)', done: true }];
  const region = REGIONS[s.chapter].at(-1).name;
  return [
    { label: `atender ${region} nesta partida`, done: lastRegion(s) },
    { label: `${need.points} pontos de legado no capítulo (${s.legacy.earned})`, done: s.legacy.earned >= need.points },
  ];
}
export const canColonize = (s) => !!nextChapter(s) && colonizeStatus(s).length > 0 && colonizeStatus(s).every((c) => c.done);
export const patentGain = (s) => Math.floor(Math.sqrt(s.legacy.earned / PATENTS.divisor));

// Herança da Fronteira: o que um save da 1.x tinha do Enxame, Kugelblitz e Vácuo volta no
// capítulo delas (unidades, upgrades e pesquisas), uma vez.
function inherit(s) {
  const stash = s.empire.frontierStash;
  if (!stash) return false;
  let got = false;
  for (const g of GENERATORS.filter((x) => x.chapter === s.chapter && x.id in stash.owned)) {
    if (stash.owned[g.id] || stash.upgrades[g.id]) got = true;
    s.owned[g.id] = Math.max(s.owned[g.id], stash.owned[g.id]);
    s.upgrades[g.id] = Math.max(s.upgrades[g.id], stash.upgrades[g.id]);
    delete stash.owned[g.id];
    delete stash.upgrades[g.id];
  }
  for (const id of stash.techs) s.techs[id] = true;
  if (!Object.keys(stash.owned).length) s.empire.frontierStash = null;
  return got;
}

// Coloniza o próximo capítulo. Muta `s` no lugar (a UI e o storage seguram a referência).
// Retorna { patents, chapter, inherited } ou null se não podia.
export function colonize(s) {
  if (!canColonize(s)) return null;
  const from = s.chapter;
  const to = nextChapter(s).id;
  const patents = patentGain(s);
  const { career, achievements, empire } = s;
  empire.patents += patents;
  empire.colonies = [...empire.colonies, { chapter: from, at: career.playTime, kw: power(s) }];
  const legacy = { points: patentValue(s, 'founder', 0), earned: 0, lifetime: 0, ascensions: 0, shop: {}, monument: 0 };
  const rng = s.events.rng;
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, newState(rng), { legacy, career, achievements, empire, chapter: to });
  startRun(s);
  const inherited = inherit(s);
  add(s, 'colonizations');
  return { patents, chapter: chapterDef(to).name, inherited };
}
