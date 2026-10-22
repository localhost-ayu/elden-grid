// Regiões atendidas (2.0). Cada concessão traz a capacidade-base da rede (`base`, em kW,
// no lugar dos 150 kW fixos de antes). Para assumir a próxima (aba Rede, tecla N) é
// preciso já produzir o que ela pede (`need`, em kW, na escala real: uma cidade ~10 MW,
// um país ~1 TW, o planeta inteiro 10^13 kW = Kardashev Tipo I). A base de cada região é
// 1% do que a seguinte pede: perto da hora de expandir a rede enche, e expandir é o
// alívio. A concessão custa `costSeconds` s da renda de quem produz o que a próxima pede,
// e cada região dá +`pricePerRegion` no kWh. Pesquisa 'autoRegion' expande sozinha.
// Calibrado com scripts/simulate.js (bot ocioso, 1ª partida): Cidade ~4 min, Metrópole
// ~22, Estado ~43, País ~1h20, Continente ~1h50, Planeta ~3h45; rede saturada ~24%.
export const REGION_RULES = { costSeconds: 90, pricePerRegion: 0.05 };

// Por capítulo. `short` vai no cabeçalho ("Estado 87%").
export const REGIONS = {
  earth: [
    { name: 'Bairro', base: 1e3, need: 0 },
    { name: 'Cidade', base: 1e4, need: 1e4 },
    { name: 'Região Metropolitana', short: 'Metrópole', base: 1e5, need: 1e6 },
    { name: 'Estado', base: 1e7, need: 1e7 },
    { name: 'País', base: 1e8, need: 1e9 },
    { name: 'Continente', base: 1e11, need: 1e10 },
    { name: 'Planeta', base: 1e12, need: 1e13 },
  ],
  // Do Tipo I (10^13 kW, o 1º Enxame) ao Tipo II (4×10^23 kW, o Sol inteiro).
  solar: [
    { name: 'Órbita Baixa', base: 1e14, need: 0 },
    { name: 'Lua', base: 1e16, need: 1e16 },
    { name: 'Marte', base: 1e17, need: 1e18 },
    { name: 'Cinturão de Asteroides', short: 'Cinturão', base: 1e19, need: 1e19 },
    { name: 'Júpiter', base: 4e21, need: 1e21 },
    { name: 'Sol', base: 4e24, need: 4e23 },
  ],
  // Do Tipo II ao Tipo III (4×10^34 kW). A calibrar (2.0, etapa 5).
  galaxy: [
    { name: 'Estrelas Vizinhas', base: 1e25, need: 0 },
    { name: 'Bolha Local', base: 1e27, need: 1e27 },
    { name: 'Braço de Órion', short: 'Órion', base: 1e30, need: 1e29 },
    { name: 'Disco Galáctico', short: 'Disco', base: 4e32, need: 1e32 },
    { name: 'Núcleo Galáctico', short: 'Núcleo', base: 4e35, need: 4e34 },
  ],
};
