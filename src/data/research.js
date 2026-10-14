// Árvore de pesquisa (paga com PP). `req` lista os pré-requisitos; o PRIMEIRO é o pai
// na árvore desenhada (os demais aparecem como "requer: X" quando faltam).
// A ordem do array é a ordem dos irmãos na tela.
// Custos do fim da árvore calibrados com scripts/simulate.js: Fusão chega pouco antes do
// primeiro Legado (~36 min) e Antimatéria é prêmio de partida longa (~58 min).
//
// type: 'unlock'   (só libera algo; o gerador aponta para ela em `unlock`)
//       'genMult'  (x na geração de um gerador)    'global'   (x em toda a geração)
//       'price'    (x no preço do kWh)             'lab'      (x nos PP)
//       'battery'  (+`add` no piso noturno do solar: baterias guardam a energia do dia)
//       'capacity' (x na capacidade de transmissão da rede)
//       'auto'     (auto-compra do gerador mais barato a cada `interval` segundos)
export const TECHS = [
  // ---- eólica ----
  { id: 't_wind2',       name: 'Pás Aerodinâmicas',        cost: 3,      req: [],                type: 'genMult', gen: 'wind', mult: 2 },
  { id: 't_wind3',       name: 'Turbinas Offshore',        cost: 90,     req: ['t_wind2'],       type: 'genMult', gen: 'wind', mult: 3 },

  // ---- fontes de energia (cadeia principal) ----
  { id: 't_solar',       name: 'Células Fotovoltaicas',    cost: 5,      req: [],                type: 'unlock' },
  { id: 't_solar2',      name: 'Painéis Bifaciais',        cost: 60,     req: ['t_solar'],       type: 'genMult', gen: 'solar', mult: 2 },
  { id: 't_battery',     name: 'Baterias de Lítio',        cost: 200,    req: ['t_solar2'],      type: 'battery', add: 0.35 },
  { id: 't_hydro',       name: 'Engenharia Hidráulica',    cost: 40,     req: ['t_solar'],       type: 'unlock' },
  { id: 't_hydro2',      name: 'Turbinas Francis',         cost: 450,    req: ['t_hydro'],       type: 'genMult', gen: 'hydro', mult: 2 },
  { id: 't_biomass',     name: 'Bioenergia',               cost: 150,    req: ['t_hydro'],       type: 'unlock' },
  { id: 't_biomass2',    name: 'Biodigestores',            cost: 1000,   req: ['t_biomass'],     type: 'genMult', gen: 'biomass', mult: 2 },
  { id: 't_gas',         name: 'Gás Natural',              cost: 300,    req: ['t_hydro'],       type: 'unlock' },
  { id: 't_geo',         name: 'Perfuração Profunda',      cost: 1500,   req: ['t_gas'],         type: 'unlock' },
  { id: 't_nuclear',     name: 'Fissão Controlada',        cost: 3000,   req: ['t_gas'],         type: 'unlock' },
  { id: 't_nuclear2',    name: 'Enriquecimento a Laser',   cost: 12000,  req: ['t_nuclear'],     type: 'genMult', gen: 'nuclear', mult: 2 },
  { id: 't_tidal',       name: 'Barragens de Maré',        cost: 8000,   req: ['t_nuclear'],     type: 'unlock' },
  { id: 't_fusion',      name: 'Fusão Magnética',          cost: 15000,  req: ['t_nuclear'],     type: 'unlock' },
  { id: 't_antimatter',  name: 'Contenção de Antimatéria', cost: 60000,  req: ['t_fusion'],      type: 'unlock' },

  // ---- rede e mercado ----
  { id: 't_grid',        name: 'Rede Inteligente',         cost: 20,     req: [],                type: 'price',    mult: 1.25 },
  { id: 't_hv',          name: 'Linhas de Alta Tensão',    cost: 30,     req: ['t_grid'],        type: 'capacity', mult: 20 },
  { id: 't_substation',  name: 'Subestações',              cost: 400,    req: ['t_hv'],          type: 'capacity', mult: 30 },
  { id: 't_hvdc',        name: 'Linhas HVDC',              cost: 2500,   req: ['t_substation'],  type: 'capacity', mult: 40 },
  { id: 't_continental', name: 'Rede Continental',         cost: 12000,  req: ['t_hvdc'],        type: 'capacity', mult: 50 },
  { id: 't_planetary',   name: 'Rede Planetária',          cost: 100000, req: ['t_continental'], type: 'capacity', mult: 60 },
  { id: 't_grid2',       name: 'Supercondutores',          cost: 1200,   req: ['t_grid'],        type: 'global',   mult: 1.5 },
  { id: 't_global2',     name: 'Era da Eletrificação',     cost: 15000,  req: ['t_grid2'],       type: 'global',   mult: 2 },
  { id: 't_market',      name: 'Mercado Livre de Energia', cost: 9000,   req: ['t_grid', 't_hvdc'], type: 'price',  mult: 1.5 },

  // ---- laboratório e automação ----
  { id: 't_lab',         name: 'Método Científico',        cost: 120,    req: [],                type: 'lab',  mult: 2 },
  { id: 't_lab2',        name: 'Computação Quântica',      cost: 5000,   req: ['t_lab'],         type: 'lab',  mult: 2 },
  { id: 't_lab3',        name: 'Colaboração Global',       cost: 60000,  req: ['t_lab2'],        type: 'lab',  mult: 3 },
  { id: 't_auto',        name: 'Automação Industrial',     cost: 800,    req: ['t_lab'],         type: 'auto', interval: 1 },
  { id: 't_auto2',       name: 'Gestão por IA',            cost: 20000,  req: ['t_auto'],        type: 'auto', interval: 0.2 },
];
