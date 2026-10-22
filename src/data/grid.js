// Rede de transmissão: quanto da produção chega ao mercado pelo preço cheio.
// Produção acima da capacidade ainda é vendida, mas com desconto (energia "despejada"
// no mercado spot). É o gargalo que obriga o jogador a investir na rede.
export const GRID = {
  baseCapacity: 150,     // kW do Bairro, sem pesquisas (as regiões mudam a base: data/regions.js)
  excessPriceRate: 0.25, // fração do preço paga pelo excedente
  // Transformadores: expansão comprada com dinheiro (aba Rede, tecla T), além das
  // pesquisas. Cada um: capacidade x1.2; custo = baseCost × growth^comprados.
  // Crescimento forte (x6) de propósito: é um alívio pontual, não um substituto das
  // pesquisas de rede (calibrado com o bot: barato demais zerava o gargalo).
  transformer: { capacityMult: 1.2, baseCost: 2000, growth: 6 },
};
