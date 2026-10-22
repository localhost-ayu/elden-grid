// Desgaste e quebras das usinas. Não importa o engine: o engine consulta wearFactor
// daqui, e quem paga a manutenção calcula a receita e passa o custo.
import { WEAR, WEAR_BY_GEN } from '../data/wear.js';
import { GENERATORS } from '../data/generators.js';
import { add } from './records.js';

export const newWear = () => ({
  level: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
  broken: [], // [{ gen, at }]: unidade parada desde `at`
  crew: false,
});

export const wearLevel = (s, g) => s.wear.level[g.id] ?? 0;
export const efficiency = (w) => 1 - (1 - WEAR.floor) * w;
export const brokenCount = (s, g) => s.wear.broken.filter((b) => b.gen === g.id).length;

// x na produção da fonte: desgaste e unidades quebradas.
export function wearFactor(s, g) {
  const n = s.owned[g.id];
  if (!n) return 1;
  return efficiency(wearLevel(s, g)) * Math.max(0, n - brokenCount(s, g)) / n;
}

// Desgaste cresce com o tempo de jogo online; a equipe segura no teto dela.
export function wearStep(s, dt) {
  for (const g of GENERATORS) {
    if (!s.owned[g.id]) continue;
    const def = WEAR_BY_GEN[g.id];
    let w = Math.min(1, wearLevel(s, g) + dt / def.time);
    if (s.wear.crew) w = Math.min(w, WEAR.crewCap);
    s.wear.level[g.id] = w;
  }
}

export const clean = (s, g) => { s.wear.level[g.id] = 0; };

// Quebras (só online e fora do disfarce): sorteia com `rand` e devolve a quebra nova.
// A equipe conserta sozinha depois de crewFixSeconds.
export function breakdownStep(s, dt, rand) {
  const notes = [];
  if (s.wear.crew) {
    const fixed = s.wear.broken.filter((b) => s.t - b.at >= WEAR.crewFixSeconds);
    s.wear.broken = s.wear.broken.filter((b) => !fixed.includes(b));
    for (const b of fixed) notes.push({ type: 'fixed', gen: b.gen, crew: true });
  }
  const candidates = GENERATORS.filter((g) => s.owned[g.id] - brokenCount(s, g) >= 2);
  if (s.wear.broken.length < WEAR.maxBroken && candidates.length && rand() < WEAR.breakChance * dt) {
    const g = candidates[Math.floor(rand() * candidates.length)];
    s.wear.broken.push({ gen: g.id, at: s.t });
    add(s, 'breakdowns');
    notes.push({ type: 'broke', gen: g.id });
  }
  return notes;
}

export function fix(s, genId) {
  const i = s.wear.broken.findIndex((b) => b.gen === genId);
  if (i < 0) return false;
  s.wear.broken.splice(i, 1);
  return true;
}
