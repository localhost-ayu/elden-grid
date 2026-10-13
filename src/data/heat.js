// Calor dos reatores (geradores com trait `heat`: nuclear, fusão, antimatéria).
//
// Cada tipo de reator tem um nível de calor h (0 = frio, 1 = limite). O calor caminha
// para um alvo:  alvo = base × (1 + intensity × log2(multiplicador de produção)) / resfriamento
// ou seja: quanto mais upgrades/marcos o reator tem, mais quente ele roda — e o
// resfriamento (comprado com dinheiro na aba Rede) compensa.
export const HEAT = {
  tau: 20,              // s para percorrer ~63% do caminho até o alvo (inércia térmica)
  intensity: 0.15,      // quanto cada dobra de produção esquenta
  warnAt: 0.8,          // acima disso a eficiência cai...
  maxPenalty: 0.5,      // ...linearmente até -50% no limite
  shutdownAt: 1,        // no limite: desligamento forçado
  shutdownSeconds: 10,  // duração do desligamento (o reator esfria nesse tempo)
};

// Resfriamento: cada nível divide o alvo de calor por `factor`.
// Custo = baseCost do gerador × costMult do nível.
export const COOLING = {
  factor: 1.5,
  levels: [
    { name: 'Torres de Resfriamento', costMult: 5 },
    { name: 'Circuito Fechado', costMult: 50 },
    { name: 'Sal Fundido', costMult: 500 },
    { name: 'Hélio Líquido', costMult: 5000 },
    { name: 'Criogenia Quântica', costMult: 50000 },
  ],
};
