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
