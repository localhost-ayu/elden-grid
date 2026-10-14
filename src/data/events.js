// Eventos aleatórios. Os passivos só mudam o jogo por `duration` segundos; as crises
// (`crisis`) ficam ativas até o jogador resolver, falhar ou chamar a equipe.
//
// Efeitos { type, mult, gen? } (compostos por produto em core/events.js):
//   output    produção (de um gerador, se tiver `gen`; senão, toda)
//   price     preço do kWh
//   capacity  capacidade da rede
//   heat      alvo de calor dos reatores
// `article`: o/a, para as mensagens concordarem ("o blecaute", "a sobrecarga").
// `requires`: condição para o evento poder ser sorteado (ver core/incidents.js).
export const EVENTS = [
  {
    id: 'storm', name: 'Tempestade', weight: 3, duration: 45,
    desc: 'eólica x2, solar x0.5',
    effects: [{ type: 'output', gen: 'wind', mult: 2 }, { type: 'output', gen: 'solar', mult: 0.5 }],
  },
  {
    id: 'demand', name: 'Pico de demanda', weight: 3, duration: 20,
    desc: 'preço do kWh x2',
    effects: [{ type: 'price', mult: 2 }],
  },
  {
    id: 'discovery', name: 'Descoberta', weight: 2, duration: 8,
    desc: 'o laboratório ganha 2 min de pesquisa',
    effects: [], rpSeconds: 120, requires: 'lab',
  },
  // Sem reator, a onda de calor só encarece a energia; com reator, vira crise.
  {
    id: 'heatwave', name: 'Onda de calor', weight: 2, duration: 40, requires: 'noReactor',
    desc: 'preço x1.3',
    effects: [{ type: 'price', mult: 1.3 }],
  },
  {
    id: 'heatwave_crisis', name: 'Onda de calor', article: 'a', weight: 2, crisis: 'valves', requires: 'reactor',
    desc: 'preço x1.3, mas os reatores esquentam 40% mais',
    effects: [{ type: 'price', mult: 1.3 }, { type: 'heat', mult: 1.4 }],
  },
  {
    id: 'blackout', name: 'Blecaute regional', article: 'o', weight: 2, crisis: 'reboot', requires: 'power',
    desc: 'produção -50% até a rede voltar',
    effects: [{ type: 'output', mult: 0.5 }],
  },
  {
    id: 'overload', name: 'Sobrecarga na subestação', article: 'a', weight: 2, crisis: 'rewire', requires: 'loaded',
    desc: 'capacidade da rede pela metade',
    effects: [{ type: 'capacity', mult: 0.5 }],
  },
];

// Manual de crise: qual minijogo resolve cada uma e o que dizer ao jogador.
export const CRISES = {
  reboot: {
    title: 'Religar a rede', game: 'timing',
    steps: ['O cursor corre da esquerda para a direita.', 'Aperte ESPAÇO com ele dentro da faixa: 3 acertos religam a rede.', '3 erros e a rede não volta.'],
  },
  valves: {
    title: 'Abrir as válvulas de alívio', game: 'mash',
    steps: ['Alterne ← e → o mais rápido que puder para encher a pressão.', 'A pressão vaza sozinha: encha a barra antes do tempo acabar.'],
  },
  rewire: {
    title: 'Remanejar os circuitos', game: 'sequence',
    steps: ['Digite a sequência de setas mostrada, na ordem.', 'Cada tecla errada é um erro; 3 erros ou o tempo acabando = falha.'],
  },
};

export const SCHEDULE = {
  first: 150,       // s de jogo até o primeiro evento (o começo é para aprender)
  gapMin: 60,       // intervalo entre eventos: sorteado em [gapMin, gapMax]
  gapMax: 180,
  crisisDeadline: 90, // sem ação nesse tempo, a equipe é chamada sozinha
};

// Danos de uma crise = o menor entre uma fração do dinheiro guardado e alguns segundos
// de renda: dói, mas nunca leva a poupança embora nem pune demais quem está ausente.
export const DAMAGE = { moneyShare: 0.1, incomeSeconds: 60 };

// Resolver no braço sai de graça e ainda rende um bônus.
export const REWARD = { id: 'tuned', name: 'Rede afinada', duration: 45, effects: [{ type: 'output', mult: 1.25 }] };
