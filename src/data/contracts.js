// Contratos de fornecimento (aba Mercado). Até `offers` ofertas por vez; uma nova chega a
// cada `every` s e cada uma some depois de `expires` s se ninguém aceitar. Um contrato
// ativo por vez; falhar só perde o contrato (sem multa).
//
// Tipos (`goal` é a meta em relação ao ritmo atual; `duration` em s, sorteada):
//   delivery  produzir goal × (produção atual × duração) kWh
//   sales     faturar goal × (renda atual × duração) $ (baterias e surtos ajudam)
//   green     manter a fração renovável da produção acima da meta pela duração inteira
//             (meta = fração atual + `gap`, até `cap`)
//   firm      nenhum reator desliga pela duração inteira (só com reator quente)
// Recompensa: `money` s de renda ou `rp` s de pesquisa (sorteado), x `bonus` do tipo.
export const CONTRACT_RULES = { offers: 3, every: 45, expires: 150, firstAt: 120 };

export const GREEN = ['wind', 'solar', 'hydro', 'biomass', 'geothermal', 'tidal', 'swarm'];

export const CONTRACTS = {
  delivery: { name: 'Entrega', weight: 3, duration: [90, 180], goal: [1.25, 1.6], bonus: 1 },
  sales: { name: 'Venda', weight: 3, duration: [60, 150], goal: [1.3, 1.7], bonus: 1.1 },
  green: { name: 'Verde', weight: 2, duration: [60, 120], gap: 0.1, cap: 0.95, bonus: 1.2 },
  firm: { name: 'Firme', weight: 2, duration: [60, 120], bonus: 0.8 },
};

// Faixas da recompensa base (s de renda ou de pesquisa).
export const CONTRACT_REWARD = { money: [60, 150], rp: [45, 100], rpChance: 0.35 };
