// Histórico dos gráficos da aba Rede. Fica só em memória (não vai para o save): serve
// para ver a tendência recente.
import { power, income } from './engine.js';

export const HISTORY_LEN = 60;

export const createHistory = () => ({ kw: [], income: [], last: null });

// Amostra no máximo uma vez por segundo de jogo (s.t), independente da taxa de quadros.
export function sampleHistory(h, s) {
  if (h.last !== null && s.t - h.last < 1) return false;
  h.last = s.t;
  h.kw.push(power(s));
  h.income.push(income(s));
  if (h.kw.length > HISTORY_LEN) { h.kw.shift(); h.income.shift(); }
  return true;
}
