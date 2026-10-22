// Previsão das próximas horas de jogo: vento, sol, maré, vácuo e preço. O ambiente é
// determinístico (traits.js), então a previsão "perfeita" é só calcular adiante; para ela
// ter graça, cada ponto leva um erro que cresce com a distância. O erro é pseudoaleatório
// por hora absoluta de jogo: o mesmo ponto não pisca entre quadros e vai se acertando
// conforme se aproxima. Pesquisas 'forecast' reduzem o erro.
import { GENERATORS } from '../data/generators.js';
import { TECHS } from '../data/research.js';
import { windLevel, sunLevel, tideLevel, vacuumLevel } from './traits.js';
import { hashString } from './challenges.js';
import { priceBase } from './engine.js';

export const HORIZON = 24; // horas de jogo (= s reais)
export const STEP = 0.5;   // um ponto a cada meia hora
const BASE_ERROR = 0.3; // erro relativo no fim do horizonte, sem pesquisa

export const forecastError = (s) =>
  BASE_ERROR * TECHS.filter((t) => t.type === 'forecast' && s.techs[t.id]).reduce((m, t) => m * t.mult, 1);

// Ruído em [-1, 1] estável para (série, hora absoluta).
const noise = (id, hour) => (hashString(`${id}:${hour}`) / 0xffffffff) * 2 - 1;

const trait = (id, type) => GENERATORS.find((g) => g.id === id)?.traits.find((tr) => tr.type === type);

// Séries que interessam a esta partida: só o que o jogador tem (o preço, sempre).
export function forecast(s, steps = HORIZON / STEP) {
  const err = forecastError(s);
  const at = (h) => ({ ...s, t: s.t + h });
  const series = [];
  const add = (id, label, fn) => {
    const values = [];
    for (let i = 0; i < steps; i++) {
      const h = i * STEP;
      const hour = Math.floor((s.t + h) / STEP);
      const truth = fn(at(h));
      values.push(h === 0 ? truth : Math.max(0, truth * (1 + err * (h / HORIZON) * noise(id, hour))));
    }
    series.push({ id, label, values });
  };
  if (s.owned.wind > 0) add('wind', 'Vento', windLevel);
  if (s.owned.solar > 0) add('sun', 'Sol', sunLevel);
  if (s.owned.tidal > 0) add('tide', 'Maré', (x) => tideLevel(x, trait('tidal', 'tide')));
  if (s.owned.vacuum > 0) add('vacuum', 'Vácuo', (x) => vacuumLevel(x, trait('vacuum', 'vacuum')));
  // Preço: a oscilação de sempre na demanda para onde o mercado está indo. Surtos não
  // entram (ninguém prevê).
  add('price', 'Preço', (x) => (1 + 0.2 * Math.sin(x.t / 15)) * priceBase(s) * s.market.target);
  return { err, series };
}
