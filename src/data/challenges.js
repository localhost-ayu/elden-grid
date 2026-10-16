// Desafios: partidas no slot D, do zero e sem legado, com uma regra que muda o jogo.
// Cada desafio tem 5 níveis; o nível n exige ganhar GOALS[n-1] na partida e endurece a
// regra. Completar um nível sobe o perfil compartilhado (ver core/profile.js), e as
// recompensas valem nos slots 1–3 (etapa seguinte da 1.2).
//
// Regras (`rules[n-1]`), interpretadas em core/challenges.js:
//   eventGap       x no intervalo entre eventos (menor = mais eventos)
//   crisisWeight   x no peso das crises no sorteio
//   disabled       fontes que não podem ser compradas
//   noCrank        manivela desligada
//   start          unidades com que a partida começa ({ gerador: n })
//   techs          pesquisas prontas no começo
//   capacityExp    expoente nas pesquisas de capacidade (0.5 = Linhas x20 viram x4.5)
//   priceHalfLife  segundos de partida para o preço do kWh cair à metade...
//   priceFloor     ...até este piso
//   upkeep         x no custo de operação (gás e fusão)
export const GOALS = [2.5e10, 1e11, 5e11, 2.5e12, 1e13];

const tiers = (make) => [1, 2, 3, 4, 5].map(make);

export const CHALLENGES = [
  {
    id: 'blackout', name: 'Apagão Eterno', icon: '⚠',
    desc: 'eventos e crises chegam sem parar',
    rules: tiers((n) => ({ eventGap: [0.5, 0.4, 0.3, 0.25, 0.2][n - 1], crisisWeight: [2, 3, 4, 5, 6][n - 1] })),
  },
  {
    id: 'calm', name: 'Sem Vento', icon: '~',
    desc: 'sem eólica e sem manivela; começa com 1 solar',
    rules: tiers((n) => ({
      disabled: ['wind'], noCrank: true, start: { solar: 1 }, techs: ['t_solar'],
      // Do nível 3 em diante, a hidrelétrica também fica de fora.
      ...(n >= 3 ? { disabled: ['wind', 'hydro'] } : {}),
    })),
  },
  {
    id: 'oldgrid', name: 'Rede Velha', icon: '#',
    desc: 'pesquisas de capacidade da rede rendem menos',
    rules: tiers((n) => ({ capacityExp: [0.7, 0.6, 0.5, 0.4, 0.3][n - 1] })),
  },
  {
    id: 'crash', name: 'Mercado em Queda', icon: 'v',
    desc: 'o preço do kWh cai conforme a partida avança',
    rules: tiers((n) => ({ priceHalfLife: [2400, 2000, 1800, 1500, 1200][n - 1], priceFloor: [0.4, 0.35, 0.3, 0.25, 0.2][n - 1] })),
  },
  {
    id: 'fuel', name: 'Combustível Caro', icon: '$',
    desc: 'gás e fusão custam muito mais para operar',
    rules: tiers((n) => ({ upkeep: [3, 4, 6, 8, 10][n - 1] })),
  },
];
