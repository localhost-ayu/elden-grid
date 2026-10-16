// Pontos totais = floor(sqrt(dinheiro ganho em todas as partidas / divisor)). A raiz faz
// cada ponto novo custar mais que o anterior, então ascender cedo e sempre rende pouco.
// Calibrado com o bot: minRunEarned chega por volta de 45 min de jogo ativo (~5 pontos).
export const LEGACY = {
  divisor: 1e9,
  minRunEarned: 2.5e10,
  // Por ponto NÃO gasto: gastar na loja troca bônus por vantagens, uma escolha de verdade.
  bonusPerPoint: 0.1,
};

// Monumento: compra repetível, sem teto. Cada nível multiplica a produção por `mult` e
// custa ceil(baseCost × growth^nível) pontos. Como o bônus de ponto guardado é somado
// (+10% cada), ele perde força com centenas de pontos; o Monumento, multiplicativo, passa
// a valer mais. Guardar ou erguer o Monumento é uma escolha que muda com o tempo.
export const MONUMENT = { name: 'Monumento', mult: 1.1, baseCost: 10, growth: 1.15 };

// `values[i]` é o efeito no nível i+1; `costs[i]`, o preço em pontos desse nível.
// Os níveis 4 e 5 (1.1) custam bem mais: são o objetivo de quem já tem a loja básica.
//   start        eólicas com que cada partida começa
//   cost         x no preço de todos os geradores
//   lab          x nos PP
//   offline      teto (horas) e fração da produção do progresso offline
//   auto         auto-compra desde o início, com este intervalo (s)
//   crank        fração da produção de 1 s que a manivela rende
//   techs        pesquisas já concluídas no começo da partida (lista cumulativa; cada
//                lista inclui os pré-requisitos das suas pesquisas)
//   cooling      níveis de resfriamento com que os reatores começam
//   damage       x no custo das crises perdidas ou deixadas para a equipe
//   milestones   x na quantidade exigida pelos marcos (25/50/100 -> 20/40/80 -> 15/30/60)
//   transformers transformadores com que cada partida começa
const T1 = ['t_wind2', 't_solar', 't_grid', 't_lab'];
const T2 = [...T1, 't_hydro', 't_hv', 't_solar2', 't_biomass'];
const T3 = [...T2, 't_gas', 't_substation', 't_auto', 't_hydro2'];

export const SHOP = [
  { id: 'start', name: 'Começo Rápido', type: 'start', costs: [2, 5, 12, 30, 80], values: [10, 25, 50, 100, 200] },
  { id: 'contracts', name: 'Contratos de Obra', type: 'cost', costs: [3, 8, 20, 45, 100], values: [0.9, 0.8, 0.7, 0.6, 0.5] },
  { id: 'grants', name: 'Bolsas de Pesquisa', type: 'lab', costs: [2, 5, 12, 30, 70], values: [1.5, 2, 3, 5, 8] },
  {
    id: 'nightshift', name: 'Turno da Noite', type: 'offline', costs: [1, 3, 8, 20, 45],
    values: [{ hours: 2, rate: 0.6 }, { hours: 4, rate: 0.7 }, { hours: 8, rate: 0.8 }, { hours: 12, rate: 0.85 }, { hours: 24, rate: 0.9 }],
  },
  { id: 'heirloom', name: 'Automação Herdada', type: 'auto', costs: [4], values: [1] },
  { id: 'goldcrank', name: 'Manivela de Ouro', type: 'crank', costs: [1, 3, 8, 20, 45], values: [1, 2, 5, 10, 25] },
  { id: 'research', name: 'Pesquisa Herdada', type: 'techs', costs: [5, 15, 40], values: [T1, T2, T3] },
  { id: 'thermal', name: 'Engenharia Térmica', type: 'cooling', costs: [6, 18, 45], values: [1, 2, 3] },
  { id: 'insurance', name: 'Seguro de Rede', type: 'damage', costs: [4, 12, 30], values: [0.75, 0.5, 0] },
  { id: 'early', name: 'Marcos Antecipados', type: 'milestones', costs: [10, 30], values: [0.8, 0.6] },
  { id: 'inherited', name: 'Rede Herdada', type: 'transformers', costs: [3, 10, 25], values: [1, 2, 3] },
];
