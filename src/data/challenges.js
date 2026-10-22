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
//   noReward       vencer uma crise não dá o bônus de Rede afinada
//   cost           x no preço de fontes específicas ({ gerador: x })
//   output         x na produção de fontes específicas ({ gerador: x })
//   heat           x no alvo de calor dos reatores
//   crisisLevel    nível fixo das crises (sem a regra: CRISIS.runLevel, em data/events.js)
//   volatility     x na largura da faixa da demanda e na chance de surto (data/market.js)
//   demandShift    desloca o centro da demanda (negativo = o mercado paga menos na média)
//   impact         x no impacto das vendas no preço
// 1.4: metas III–V subiram (eram 5e11, 2.5e12, 1e13): com a Fronteira, o nível V caía
// para ~1h30–2h20. Bot: I ~40 min, III ~1h20, IV ~2h10, V 2h45–3h55.
export const GOALS = [2.5e10, 1e11, 1e12, 3e13, 1e15];

// Recompensas (valem nos slots 1–3, nunca dentro de um desafio). Cada nível completo de
// qualquer desafio multiplica a produção por TIER_MULT (25 níveis: x10.8), e cada desafio
// dá a sua vantagem temática, `per` por nível, somada (`reward` em cada desafio):
//   crisisTime   +s de prazo para atender as crises
//   solar        +fração de produção da solar (e Células Fotovoltaicas pronta no começo)
//   capacity     +fração de capacidade da rede
//   price        +fração no preço do kWh
//   upkeep       -fração no custo de operação
//   battery      +fração na capacidade dos bancos de bateria
export const TIER_MULT = 1.1;

const tiers = (make) => [1, 2, 3, 4, 5].map(make);

// Calibrado com scripts/simulate.js --challenge (linha de base sem regra: I 36 min, V 1h51).
// O bot vence toda crise na hora, então o Apagão Eterno pesa mais para um humano.
const FUEL = ['biomass', 'gas', 'nuclear', 'fusion', 'antimatter'];

export const CHALLENGES = [
  {
    id: 'blackout', name: 'Apagão Eterno', icon: '⚠',
    desc: 'eventos e crises chegam sem parar',
    reward: { type: 'crisisTime', per: 15, name: 'Equipe de Plantão' },
    rules: tiers((n) => ({
      eventGap: [0.5, 0.4, 0.3, 0.25, 0.2][n - 1], crisisWeight: [2, 3, 4, 5, 6][n - 1], noReward: true,
      crisisLevel: [3, 5, 7, 9, 10][n - 1],
    })),
  },
  {
    id: 'calm', name: 'Sem Vento', icon: '~',
    desc: 'sem vento: menos fontes e reatores mais quentes',
    reward: { type: 'solar', per: 0.2, name: 'Brisa Solar' },
    rules: tiers((n) => ({
      disabled: ['wind', 'hydro', ...(n >= 3 ? ['tidal'] : []), ...(n >= 5 ? ['geothermal'] : [])],
      noCrank: true, start: { solar: 1 }, techs: ['t_solar'],
      heat: [1.3, 1.6, 2, 2.6, 3.2][n - 1],
    })),
  },
  {
    id: 'oldgrid', name: 'Rede Velha', icon: '#',
    desc: 'pesquisas de capacidade da rede rendem menos',
    reward: { type: 'capacity', per: 0.25, name: 'Rede Robusta' },
    rules: tiers((n) => ({ capacityExp: [0.74, 0.72, 0.71, 0.7, 0.68][n - 1] })),
  },
  {
    id: 'crash', name: 'Mercado em Queda', icon: 'v',
    desc: 'o preço do kWh cai conforme a partida avança',
    reward: { type: 'price', per: 0.05, name: 'Contratos Futuros' },
    rules: tiers((n) => ({ priceHalfLife: [1800, 1700, 1600, 1500, 1400][n - 1], priceFloor: [0.45, 0.42, 0.4, 0.37, 0.35][n - 1] })),
  },
  {
    id: 'fuel', name: 'Combustível Caro', icon: '$',
    desc: 'usinas a combustível rendem bem menos',
    reward: { type: 'upkeep', per: 0.1, name: 'Eficiência Térmica' },
    rules: tiers((n) => ({
      upkeep: [2, 3, 4, 5, 6][n - 1],
      output: Object.fromEntries(FUEL.map((id) => [id, [0.6, 0.5, 0.42, 0.36, 0.32][n - 1]])),
    })),
  },
  {
    id: 'volatile', name: 'Mercado Volátil', icon: '%',
    desc: 'o preço dispara e despenca; na média, paga menos',
    reward: { type: 'battery', per: 0.25, name: 'Corretora de Energia' },
    rules: tiers((n) => ({
      volatility: [1.6, 2, 2.4, 2.8, 3.2][n - 1], demandShift: [-0.1, -0.15, -0.2, -0.25, -0.3][n - 1],
      impact: [1.5, 2, 2.5, 3, 3.5][n - 1],
    })),
  },
];
