// Mercado (1.5): o preço do kWh deixa de ser só a senoide. Por cima dela:
//   demanda  passeia devagar entre `min` e `max`: a cada `every` s (sorteado no
//            intervalo) escolhe um alvo novo e caminha até ele (constante `tau` s).
//   surto    com chance `chance` a cada alvo novo, a demanda salta para `mult` por
//            `duration` s (sorteado): hora de vender.
//   impacto  vender de uma vez (baterias) derruba o preço: cada venda soma
//            energia / profundidade, e o preço vira preço / (1 + impacto). O impacto
//            cai à metade a cada `halfLife` s. A profundidade é `depthSeconds` s da
//            capacidade da rede: vender o equivalente a isso derruba o preço à metade.
// Tudo com a sorte própria do mercado (no save), para não mexer na sequência de eventos.
export const MARKET = {
  demand: { min: 0.85, max: 1.2, every: [15, 35], tau: 6 },
  surge: { chance: 0.15, mult: 1.6, duration: [8, 15] },
  impact: { halfLife: 20, depthSeconds: 60 },
};

// Banco de baterias: cada banco guarda `bankSeconds` s da capacidade da rede (escala com
// a partida). Custo = baseCost × growth^bancos; no máximo `maxBanks`.
//   Carga: o excedente da rede (o que passaria da capacidade) entra sozinho; com
//   "carregar barato" ligado, também `cheapShare` da produção quando o preço está abaixo
//   da média (essa energia deixa de ser vendida na hora).
//   Venda manual: tudo de uma vez a `manualRate` do valor, sofrendo o próprio impacto.
//   Venda automática: quando o preço passa de `autoAbove` × a média (ou num surto),
//   vende `autoShare` da carga por segundo, a `autoRate` do valor.
export const BATTERY = {
  bankSeconds: 20, baseCost: 5000, growth: 6, maxBanks: 10,
  cheapShare: 0.5, manualRate: 0.95, autoRate: 0.8, autoAbove: 1.12, autoShare: 0.25,
};

// Reputação da companhia: sobe com contratos cumpridos e usinas bem cuidadas, cai com
// contratos perdidos e quebras esquecidas. Cada faixa acima da primeira paga
// `rewardPerTier` a mais nos contratos e `pricePerTier` a mais no kWh. Zera na ascensão.
//   care      a cada `careEvery` s: eficiência média das usinas >= `careAt` dá +care;
//             uma quebra aberta há mais de `neglectAfter` s dá -neglect
export const REPUTATION = {
  tiers: [
    { name: 'Desconhecida', at: 0 }, { name: 'Local', at: 10 }, { name: 'Regional', at: 30 },
    { name: 'Nacional', at: 60 }, { name: 'Global', at: 100 },
  ],
  max: 150, contractWon: 5, contractLost: 3,
  careEvery: 60, careAt: 0.93, care: 1, neglectAfter: 60, neglect: 2,
  rewardPerTier: 0.15, pricePerTier: 0.02,
};
