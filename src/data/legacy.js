// Pontos totais = floor((dinheiro ganho em todas as partidas / divisor)^exponent). A raiz
// faz cada ponto novo custar mais que o anterior, então ascender cedo e sempre rende pouco.
// Raiz cúbica desde a 1.4: o dinheiro cresce exponencialmente com a duração da partida, e
// com a raiz quadrada uma partida longa até a Fronteira dava 100x mais pontos que a
// anterior (simulado). O divisor mantém a 1ª ascensão em ~20 pontos.
// Ascender pede minRunEarned na partida E uma das condições da fase atual de `gate` do
// capítulo (2.0: uma região atendida): a ascensão fecha uma partida completa. Ficar mais
// tempo rende mais pontos pela raiz. A fase é a última com `from` <= ascensões feitas: as
// primeiras partidas de cada capítulo fecham numa região do meio (País, Marte, Disco);
// depois, só na última (Planeta, Sol, Núcleo).
// Tipos de condição (avaliadas em core/prestige.js):
//   region at     atender a região de índice `at` (data/regions.js) nesta partida
//   owned  gen    ter ao menos 1 unidade de `gen` nesta partida
//   techs         todas as pesquisas do capítulo concluídas
// `label` vai no checklist da aba Legado; `short`, na mensagem do que falta.
const ALL_TECHS = { type: 'techs', label: 'todas as pesquisas', short: 'todas as pesquisas' };
export const LEGACY = {
  divisor: 5e7,
  exponent: 1 / 3,
  minRunEarned: 2.5e10,
  gate: {
    earth: [
      { from: 0, any: [{ type: 'region', at: 4, label: 'atender o País', short: 'atender o País' }, ALL_TECHS] },
      { from: 3, any: [{ type: 'region', at: 6, label: 'atender o Planeta', short: 'atender o Planeta' }, ALL_TECHS] },
    ],
    solar: [
      { from: 0, any: [{ type: 'region', at: 2, label: 'atender Marte', short: 'atender Marte' }, ALL_TECHS] },
      { from: 3, any: [{ type: 'region', at: 5, label: 'atender o Sol', short: 'atender o Sol' }, ALL_TECHS] },
    ],
    galaxy: [
      { from: 0, any: [{ type: 'region', at: 3, label: 'atender o Disco Galáctico', short: 'atender o Disco' }, ALL_TECHS] },
      { from: 3, any: [{ type: 'region', at: 4, label: 'atender o Núcleo Galáctico', short: 'atender o Núcleo' }, ALL_TECHS] },
    ],
  },
  bonusPerPoint: 0.1,
};

// Monumento: compra repetível, sem teto. Cada nível multiplica a produção por `mult` e
// custa ceil(baseCost × growth^nível) pontos. Como o bônus de ponto guardado é somado
// (+10% cada), ele perde força com centenas de pontos; o Monumento, multiplicativo, passa
// a valer mais. Guardar ou erguer o Monumento é uma escolha que muda com o tempo.
// Custo dobra a cada nível: com crescimento menor, o Monumento acompanhava os pontos e as
// partidas encolhiam a poucos minutos (medido com scripts/simulate.js).
export const MONUMENT = { name: 'Monumento', mult: 1.1, baseCost: 10, growth: 2 };

// `values[i]` é o efeito no nível i+1; `costs[i]`, o preço em pontos desse nível.
// `perks[i]` (opcional): vantagem extra do nível, com o texto da loja em `desc`.
// Preços dos níveis altos na casa dos milhares: os pontos crescem ~1.5x por ascensão, e
// com estes preços o bot completa a loja em ~17 h de jogo (scripts/simulate.js). Na 1.3
// a 1ª ascensão passou a dar ~20 pontos (antes 5) e os níveis mais caros subiram ~1.5x.
// Os níveis 4 e 5 dos itens antigos NÃO aumentam o efeito principal: tiram atrito do
// começo da partida (pesquisas prontas, laboratórios, manivela automática). Poder bruto a
// mais nesses níveis encurtava todas as partidas seguintes a poucos minutos (simulado).
//   perks: techs (pesquisas prontas), labs (laboratórios no começo), autoCrank (giros
//   automáticos por segundo nos primeiros AUTO_CRANK_SECONDS), discount (o desconto dos
//   Contratos também vale para resfriamento e transformadores)
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
//   crew         a equipe de manutenção começa contratada e fica com esta fração da receita
//   banks        bancos de bateria com que cada partida começa
const T1 = ['t_wind2', 't_solar', 't_grid', 't_lab'];
const T2 = [...T1, 't_hydro', 't_hv', 't_solar2', 't_biomass'];
const T3 = [...T2, 't_gas', 't_substation', 't_auto', 't_hydro2'];
const HV = ['t_grid', 't_hv'];
const EARLY = [...HV, 't_solar', 't_hydro'];

export const AUTO_CRANK_SECONDS = 300;

export const SHOP = [
  {
    id: 'start', name: 'Começo Rápido', type: 'start', costs: [2, 5, 12, 150, 8000], values: [10, 25, 50, 50, 50],
    perks: [null, null,
      { techs: HV, desc: '50 eólicas e alta tensão pronta' },
      { techs: EARLY, desc: '+ solar e hidrelétrica liberadas' },
      { techs: [...EARLY, 't_biomass', 't_gas'], desc: '+ biomassa e gás liberados' }],
  },
  // O desconto vale para geradores e laboratórios (laboratório caro travava o começo).
  {
    id: 'contracts', name: 'Contratos de Obra', type: 'cost', costs: [3, 8, 20, 300, 30000], values: [0.9, 0.8, 0.7, 0.7, 0.7],
    perks: [null, null, null,
      { discount: ['cooling'], desc: '-30% também no resfriamento' },
      { discount: ['cooling', 'transformers'], desc: '-30% também em transformadores' }],
  },
  {
    id: 'grants', name: 'Bolsas de Pesquisa', type: 'lab', costs: [2, 5, 12, 200, 12000], values: [1.5, 2, 3, 3, 3],
    perks: [null, null, null, { labs: 10, desc: 'pesquisa x3 e 10 laboratórios prontos' }, { labs: 25, desc: 'pesquisa x3 e 25 laboratórios prontos' }],
  },
  {
    id: 'nightshift', name: 'Turno da Noite', type: 'offline', costs: [1, 3, 8, 100, 5000],
    values: [{ hours: 2, rate: 0.6 }, { hours: 4, rate: 0.7 }, { hours: 8, rate: 0.8 }, { hours: 12, rate: 0.85 }, { hours: 24, rate: 0.9 }],
  },
  { id: 'heirloom', name: 'Automação Herdada', type: 'auto', costs: [4], values: [1] },
  {
    id: 'goldcrank', name: 'Manivela de Ouro', type: 'crank', costs: [1, 3, 8, 100, 6000], values: [1, 2, 5, 5, 5],
    perks: [null, null, null, { autoCrank: 2, desc: 'gira sozinha 2x/s nos 5 min iniciais' }, { autoCrank: 4, desc: 'gira sozinha 4x/s nos 5 min iniciais' }],
  },
  { id: 'research', name: 'Pesquisa Herdada', type: 'techs', costs: [5, 40, 3000], values: [T1, T2, T3] },
  { id: 'thermal', name: 'Engenharia Térmica', type: 'cooling', costs: [6, 80, 9000], values: [1, 2, 3] },
  // O Seguro não zera o dano: as crises endurecem com as ascensões e precisam continuar
  // pesando (1.3).
  { id: 'insurance', name: 'Seguro de Rede', type: 'damage', costs: [4, 50, 2500], values: [0.75, 0.5, 0.35] },
  { id: 'early', name: 'Marcos Antecipados', type: 'milestones', costs: [300, 80000], values: [0.8, 0.6] },
  { id: 'inherited', name: 'Rede Herdada', type: 'transformers', costs: [3, 30, 1500], values: [1, 2, 3] },
  { id: 'heircrew', name: 'Equipe Herdada', type: 'crew', costs: [8, 120, 3000], values: [0.04, 0.03, 0.02] },
  { id: 'heirbanks', name: 'Baterias Herdadas', type: 'banks', costs: [6, 90, 2500], values: [1, 3, 5] },
];
