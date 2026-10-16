// Convenção: 1 segundo real = 1 hora de jogo, então 1 kW produzindo por 1s = 1 kWh.
//
// `traits` são modificadores dinâmicos, interpretados em src/core/traits.js:
//   wind      produção x vento (0.6–1.4, oscila devagar)
//   daylight  ciclo dia/noite: floor à noite (+baterias) até floor+peak ao meio-dia
//   reservoir nível do reservatório (ciclo de ~30 dias de jogo) entre min e max
//   tide      maré: 1 ± amp, período em horas de jogo
//   upkeep    custo de operação em $/s por unidade (combustível)
//   launch    só se compra na janela de lançamento: aberta `window` s a cada `period` s
//             (pesquisas 'launch' alargam a janela). Em órbita não há noite: produção fixa.
//   feed      precisa ser alimentado: rende a fração de alimentação, que é a produção das
//             outras fontes dividida por `share` × a produção dele (no máximo 100%).
//             Pesquisas 'feed' baixam o `share`.
//   heat      gera calor (`base` = alvo de calor sem upgrades nem resfriamento; ver heat.js).
//             base > 1 = superaquece sem resfriamento (o "risco alto" da antimatéria)
// Invariante testada: upkeep < output × preço mínimo (0.8) × fração paga pelo excedente
// da rede (0.25). Assim uma usina com custo de operação dá lucro líquido mesmo com a
// rede saturada, e o dinheiro nunca fica negativo.
export const GENERATORS = [
  { id: 'wind',       key: '1', name: 'Turbina Eólica', short: 'Eólica',     baseCost: 15,     growth: 1.15, output: 1,       icon: 'Y',   art: 'wind',       unlock: null,          traits: [{ type: 'wind' }] },
  { id: 'solar',      key: '2', name: 'Painel Solar', short: 'Solar',       baseCost: 150,    growth: 1.15, output: 9,       icon: '[#]', art: 'solar',      unlock: 't_solar',     traits: [{ type: 'daylight', floor: 0.15, peak: 2.6 }] },
  { id: 'hydro',      key: '3', name: 'Hidrelétrica', short: 'Hidro',              baseCost: 1600,   growth: 1.15, output: 75,      icon: '~W~', art: 'hydro',      unlock: 't_hydro',     traits: [{ type: 'reservoir', min: 0.9, max: 1.2, period: 720 }] },
  { id: 'biomass',    key: '4', name: 'Usina de Biomassa', short: 'Biomassa',  baseCost: 5000,   growth: 1.14, output: 180,     icon: '{&}', art: 'biomass',    unlock: 't_biomass',   traits: [] },
  { id: 'gas',        key: '5', name: 'Termelétrica a Gás', short: 'Gás', baseCost: 18000,  growth: 1.15, output: 650,     icon: '|^|', art: 'gas',        unlock: 't_gas',       traits: [{ type: 'upkeep', money: 120 }] },
  { id: 'geothermal', key: '6', name: 'Geotérmica', short: 'Geotérmica',         baseCost: 70000,  growth: 1.15, output: 2000,    icon: '/^\\', art: 'geothermal', unlock: 't_geo',       traits: [] },
  { id: 'nuclear',    key: '7', name: 'Reator Nuclear', short: 'Nuclear',     baseCost: 250000, growth: 1.15, output: 6000,    icon: '(O)', art: 'nuclear',    unlock: 't_nuclear',   traits: [{ type: 'heat', base: 0.7 }] },
  { id: 'tidal',      key: '8', name: 'Maremotriz', short: 'Maremotriz',         baseCost: 900000, growth: 1.15, output: 18000,   icon: '≈≈≈', art: 'tidal',      unlock: 't_tidal',     traits: [{ type: 'tide', amp: 0.5, period: 12.42 }] },
  { id: 'fusion',     key: '9', name: 'Reator de Fusão', short: 'Fusão',    baseCost: 4e6,    growth: 1.15, output: 60000,   icon: '(*)', art: 'fusion',     unlock: 't_fusion',    traits: [{ type: 'upkeep', money: 11000 }, { type: 'heat', base: 0.85 }] },
  { id: 'antimatter', key: '0', name: 'Antimatéria', short: 'Antimatéria',        baseCost: 8e7,    growth: 1.16, output: 1.2e6,   icon: '<@>', art: 'antimatter', unlock: 't_antimatter', traits: [{ type: 'heat', base: 1.05 }] },
  // ---- Fronteira (1.4): página 2 da aba Geradores ----
  { id: 'swarm',      key: '1', name: 'Enxame Solar Orbital', short: 'Enxame',   baseCost: 3e9,    growth: 1.16, output: 3e7,     icon: '-O-', art: 'swarm',      unlock: 't_orbital',   traits: [{ type: 'launch', period: 40, window: 8 }] },
  { id: 'kugelblitz', key: '2', name: 'Kugelblitz', short: 'Kugelblitz',          baseCost: 1.2e11, growth: 1.17, output: 8e8,     icon: '(@)', art: 'kugelblitz', unlock: 't_kugel',     traits: [{ type: 'feed', share: 0.6 }] },
];

// A aba Geradores mostra PAGE_SIZE fontes por página, com as teclas 1–9 e 0 (`key`) valendo
// na página aberta. A página vem da posição na lista; a tecla de cada fonte segue a
// posição dentro da página (testado).
export const PAGE_SIZE = 10;
for (const [i, g] of GENERATORS.entries()) g.page = Math.floor(i / PAGE_SIZE);

export const LAB = { name: 'Laboratório', baseCost: 400, growth: 1.25, rpPerSec: 0.25, unlockAt: 200 };
