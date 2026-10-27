// Desgaste (1.5): cada fonte perde eficiência com o tempo, do jeito dela. O desgaste vai
// de 0 (nova) a 1 em `time` s de jogo e a produção cai até o piso: eficiência =
// 1 - (1 - FLOOR) × desgaste. Nunca abaixo de FLOOR, para quem deixa rodando não ser
// destruído.
//
// Manutenção, por fonte (aba Rede, visão Manutenção):
//   pagar     zera o desgaste na hora; custa `paySeconds` s da receita daquela fonte,
//             proporcional ao desgaste
//   à mão     minijogo curto (setas); grátis
//   equipe    contratada uma vez, cobra `crewShare` da receita bruta enquanto ligada e
//             segura o desgaste de todas as fontes em no máximo `crewCap`
// Quebras: de vez em quando uma unidade para (`breakChance` por s com usinas, no máximo
// `maxBroken` abertas). Conserto pago custa `fixSeconds` s da receita da unidade; a
// equipe conserta sozinha em `crewFixSeconds` s.
export const WEAR = {
  floor: 0.7,
  paySeconds: 30, crewShare: 0.05, crewCap: 0.1,
  breakChance: 1 / 400, maxBroken: 2, fixSeconds: 60, crewFixSeconds: 30,
  handArrows: 4,
};

// Tempo até o desgaste máximo e o que se desgasta, por fonte.
export const WEAR_BY_GEN = {
  wind: { time: 900, what: 'rolamentos gastos' },
  solar: { time: 600, what: 'poeira nos painéis' },
  hydro: { time: 1200, what: 'assoreamento' },
  biomass: { time: 900, what: 'cinzas na caldeira' },
  gas: { time: 900, what: 'filtros entupidos' },
  geothermal: { time: 1200, what: 'incrustação nos poços' },
  nuclear: { time: 1500, what: 'troca de calor fraca' },
  tidal: { time: 900, what: 'cracas nas turbinas' },
  fusion: { time: 1500, what: 'divertor gasto' },
  antimatter: { time: 1500, what: 'armadilhas desalinhadas' },
  swarm: { time: 1200, what: 'micrometeoritos' },
  helium3: { time: 1200, what: 'poeira lunar' },
  mercury: { time: 900, what: 'espelhos queimados' },
  asteroids: { time: 1200, what: 'brocas gastas' },
  jupiter: { time: 1500, what: 'cabos corroídos' },
  starlift: { time: 1500, what: 'ímãs desalinhados' },
  // O Motor de Penrose gasta a rotação do buraco negro rápido: a manutenção é a recarga.
  penrose: { time: 300, what: 'rotação gasta' },
  pulsar: { time: 1200, what: 'antenas fora de sintonia' },
  dyson: { time: 1500, what: 'cascas perfuradas' },
  quasar: { time: 900, what: 'escudos saturados' },
  darkenergy: { time: 1500, what: 'campo instável' },
  kugelblitz: { time: 1500, what: 'lentes desalinhadas' },
  vacuum: { time: 1200, what: 'ressonância fora de fase' },
};
