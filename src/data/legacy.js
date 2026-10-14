// Pontos totais = floor(sqrt(dinheiro ganho em todas as partidas / divisor)). A raiz faz
// cada ponto novo custar mais que o anterior, então ascender cedo e sempre rende pouco.
// Calibrado com o bot: minRunEarned chega por volta de 45 min de jogo ativo (~5 pontos).
export const LEGACY = {
  divisor: 1e9,
  minRunEarned: 2.5e10,
  // Por ponto NÃO gasto: gastar na loja troca bônus por vantagens, uma escolha de verdade.
  bonusPerPoint: 0.1,
};

// `values[i]` é o efeito no nível i+1; `costs[i]`, o preço em pontos desse nível.
//   start    eólicas com que cada partida começa
//   cost     x no preço de todos os geradores
//   lab      x nos PP
//   offline  teto (horas) e fração da produção do progresso offline
//   auto     auto-compra desde o início, com este intervalo (s)
//   crank    fração da produção de 1 s que a manivela rende
export const SHOP = [
  { id: 'start', name: 'Começo Rápido', type: 'start', costs: [2, 5, 12], values: [10, 25, 50] },
  { id: 'contracts', name: 'Contratos de Obra', type: 'cost', costs: [3, 8, 20], values: [0.9, 0.8, 0.7] },
  { id: 'grants', name: 'Bolsas de Pesquisa', type: 'lab', costs: [2, 5, 12], values: [1.5, 2, 3] },
  { id: 'nightshift', name: 'Turno da Noite', type: 'offline', costs: [1, 3, 8], values: [{ hours: 2, rate: 0.6 }, { hours: 4, rate: 0.7 }, { hours: 8, rate: 0.8 }] },
  { id: 'heirloom', name: 'Automação Herdada', type: 'auto', costs: [4], values: [1] },
  { id: 'goldcrank', name: 'Manivela de Ouro', type: 'crank', costs: [1, 3, 8], values: [1, 2, 5] },
];
