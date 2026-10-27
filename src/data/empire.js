// Império (2.0): a camada acima do legado. Ao terminar um capítulo, a Colonização leva a
// civilização ao próximo: reinicia o legado (pontos, loja, Monumento e ascensões) e a
// partida, e dá Patentes. O capítulo deixado vira colônia.
//
// COLONIZE[capítulo]: o que é preciso para colonizar o próximo, além de atender a última
// região na partida: `points` pontos de legado recebidos no capítulo. Calibrado com
// scripts/simulate.js --career (bot ocioso, sem legado): Terra até ~13h20, Sistema Solar
// até ~20h40, Tipo III em ~39–41 h.
export const COLONIZE = {
  earth: { points: 400 },
  solar: { points: 8000 },
};

// Patentes ganhas = floor(sqrt(pontos de legado recebidos no capítulo / divisor)).
export const PATENTS = { divisor: 4 };

// Cada colônia: x`mult` na produção, para sempre, e `perHour` Patentes por hora de jogo.
// (Calibrado: x2 deixava os capítulos seguintes rápidos demais.)
export const COLONY = { mult: 1.5, perHour: 1 };

// Árvore de Patentes (vale em todos os capítulos). `costs[i]` em Patentes; `values[i]` o
// efeito no nível i+1.
//   capital   dinheiro no começo de cada partida, em segundos da 1ª fonte do capítulo
//   founder   pontos de legado ao chegar num capítulo novo
//   archive   x no custo das pesquisas
//   autoregion  Concessões Automáticas desde o começo
//   imperial  x na produção
export const PATENT_TREE = [
  { id: 'capital', name: 'Capital Inicial', type: 'capital', costs: [2, 6, 15], values: [600, 3600, 36000] },
  { id: 'founder', name: 'Legado Fundador', type: 'founder', costs: [3, 10], values: [20, 80] },
  { id: 'archive', name: 'Arquivo de Pesquisa', type: 'archive', costs: [3, 8, 20], values: [0.8, 0.6, 0.4] },
  { id: 'autoregion', name: 'Concessões Imediatas', type: 'autoregion', costs: [4], values: [true] },
  { id: 'imperial', name: 'Produção Imperial', type: 'imperial', costs: [5, 12, 30], values: [1.25, 1.6, 2] },
];

// Visita à Terra: fora da Terra, a ascensão pode levar a próxima partida de volta ao 1º
// capítulo, com o legado e a loja do capítulo de origem. A Terra de novo não rende pontos
// pelo dinheiro: concluí-la (a condição de ascensão dela) paga `bonus` × os pontos da
// ascensão que começou a visita e devolve a civilização ao capítulo de origem.
export const VISIT = { bonus: 0.5 };
