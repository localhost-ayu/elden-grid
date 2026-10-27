// Escala de Kardashev, na fórmula de Carl Sagan: K = (log10(W) - 6) / 10, com a potência
// em watts (1 kW do jogo = 1000 W). K 0 = 1 MW; Tipo I = 10^16 W (toda a energia de um
// planeta); Tipo II = 4×10^26 W (uma estrela); Tipo III = 4×10^37 W (uma galáxia).
// `refs` são os marcos que o jogo cita para dar escala ao número.
export const KARDASHEV = {
  refs: [
    { k: 0, name: 'bairro' },
    { k: 0.3, name: 'cidade' },
    { k: 0.6, name: 'país' },
    { k: 0.73, name: 'humanidade' },
    { k: 1, name: 'Tipo I' },
    { k: 2, name: 'Tipo II' },
    { k: 3, name: 'Tipo III' },
  ],
};
