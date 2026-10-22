// Upgrades por gerador (comprados com dinheiro) e marcos automáticos por quantidade.
//
// Efeitos são modificadores { type, mult } compostos no engine (multiplicam entre si):
//   output  x na produção daquele gerador
//   cost    x no preço das próximas unidades daquele gerador
//   upkeep  x no custo de operação daquele gerador

// Marcos: ao ter N unidades de um gerador, a produção dele dobra. Cumulativos.
export const MILESTONES = [
  { at: 25, mult: 2 },
  { at: 50, mult: 2 },
  { at: 100, mult: 2 },
];

// Trilha padrão de 5 níveis. Custo = baseCost do gerador × costMult.
// Produção total com a trilha completa: 2 × 2 × 1.5 × 3 = 18x.
export const UPGRADE_TRACK = [
  { costMult: 10, effects: [{ type: 'output', mult: 2 }] },
  { costMult: 150, effects: [{ type: 'cost', mult: 0.85 }] },
  { costMult: 2500, effects: [{ type: 'output', mult: 2 }] },
  { costMult: 4e4, effects: [{ type: 'output', mult: 1.5 }] },
  { costMult: 6e5, effects: [{ type: 'output', mult: 3 }] },
];

// Fontes com custo de operação trocam o nível 4 (índice 3) por eficiência de
// combustível: o upgrade mais útil para elas é gastar menos para operar.
export const UPGRADE_OVERRIDES = {
  gas: { 3: [{ type: 'upkeep', mult: 0.5 }, { type: 'output', mult: 1.2 }] },
  fusion: { 3: [{ type: 'upkeep', mult: 0.5 }, { type: 'output', mult: 1.2 }] },
};

// Nomes de cada nível, por gerador (só sabor; os efeitos vêm da trilha acima).
export const UPGRADE_NAMES = {
  wind: ['Pás de Fibra de Vidro', 'Torres Pré-Moldadas', 'Rotores Gigantes', 'Controle de Passo', 'Turbinas de 15 MW'],
  solar: ['Vidro Antirreflexo', 'Montagem em Série', 'Células PERC', 'Rastreadores Solares', 'Perovskita'],
  hydro: ['Comportas Automáticas', 'Obras Padronizadas', 'Turbinas Kaplan', 'Reservatório Ampliado', 'Bombeamento Reversível'],
  biomass: ['Caldeira Eficiente', 'Logística de Bagaço', 'Gaseificação', 'Cogeração', 'Biorrefinaria'],
  gas: ['Queimadores Low-NOx', 'Projeto Padrão', 'Ciclo Combinado', 'Recuperação de Calor', 'Turbinas Classe H'],
  geothermal: ['Brocas de Diamante', 'Poços em Série', 'Ciclo Binário', 'Fluido Supercrítico', 'Rocha Seca Quente'],
  nuclear: ['Combustível MOX', 'Reatores Modulares', 'Geração III+', 'Recarga Online', 'Reatores Rápidos'],
  tidal: ['Lâminas Bidirecionais', 'Comportas Pré-Fabricadas', 'Lagoa de Maré', 'Turbinas de Fluxo', 'Barragem Oceânica'],
  fusion: ['Ímãs Supercondutores', 'Tokamaks em Série', 'Divertor de Tungstênio', 'Reciclagem de Trítio', 'Stellarator Otimizado'],
  antimatter: ['Armadilhas de Penning', 'Linha de Montagem', 'Aniquilação Dirigida', 'Contenção Magnética', 'Motor de Dirac'],
  kugelblitz: ['Lentes Gravitacionais', 'Colapso em Série', 'Disco de Acreção', 'Radiação Hawking', 'Ergosfera de Penrose'],
  penrose: ['Órbitas de Captura', 'Motores em Série', 'Ergosfera Ampliada', 'Rotação Recarregada', 'Buraco Negro Extremo'],
  pulsar: ['Antenas de Rádio', 'Fazendas em Série', 'Sincronia de Pulsos', 'Magnetar Domado', 'Farol Galáctico'],
  dyson: ['Coletores Estelares', 'Esferas em Série', 'Cascas Finas', 'Redes Interestelares', 'Matrioska'],
  quasar: ['Escudos de Raios X', 'Coletores em Série', 'Disco de Acreção', 'Jato Domado', 'Núcleo Ativo'],
  darkenergy: ['Medidores de Expansão', 'Câmaras em Série', 'Campo Escalar', 'Quintessência', 'Big Rip Controlado'],
  vacuum: ['Placas de Casimir', 'Câmaras em Série', 'Ressonador Quântico', 'Campo de Ponto Zero', 'Falso Vácuo Domado'],
  helium3: ['Escavadeiras Lunares', 'Bases em Série', 'Refino Criogênico', 'Ímãs de Plasma', 'Reator Aneutrônico'],
  mercury: ['Espelhos de Safira', 'Coletores Modulares', 'Concentradores', 'Escudo Térmico', 'Anel de Mercúrio'],
  asteroids: ['Sondas de Prospecção', 'Frota Padronizada', 'Fundição em Órbita', 'Catapulta Eletromagnética', 'Cinturão Industrial'],
  jupiter: ['Cabos Supercondutores', 'Sondas em Série', 'Tubo de Fluxo de Io', 'Correntes Aurorais', 'Gigante Domado'],
  starlift: ['Ímãs Coronais', 'Extratores em Série', 'Funis de Plasma', 'Vento Solar Dirigido', 'Estrela Domada'],
  swarm: ['Velas Solares', 'Satélites em Série', 'Espelhos Finos', 'Coletores de Micro-ondas', 'Anel de Dyson'],
};
