// Histórico dos gráficos da aba Rede. Fica só em memória (não vai para o save): serve
// para ver a tendência recente.
import { power, income, price } from './engine.js';

export const HISTORY_LEN = 60;

export const createHistory = () => ({ kw: [], income: [], price: [], last: null });

// Amostra no máximo uma vez por segundo de jogo (s.t), independente da taxa de quadros.
export function sampleHistory(h, s) {
  if (h.last !== null && s.t - h.last < 1) return false;
  h.last = s.t;
  h.kw.push(power(s));
  h.income.push(income(s));
  h.price.push(price(s));
  if (h.kw.length > HISTORY_LEN) { h.kw.shift(); h.income.shift(); h.price.shift(); }
  return true;
}
