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
// `rpSeconds`: entrega na hora os PP desses segundos de laboratório (a faixa não tem relógio).
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
    desc: 'o laboratório ganhou na hora a pesquisa de 2 min',
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
  // Fronteira (1.4)
  {
    id: 'containment', name: 'Ruptura de contenção', article: 'a', weight: 2, crisis: 'contain', requires: 'containment',
    desc: 'antimatéria e Kugelblitz rendem 30% até conter',
    effects: [{ type: 'output', gen: 'antimatter', mult: 0.3 }, { type: 'output', gen: 'kugelblitz', mult: 0.3 }],
  },
  {
    id: 'solarstorm', name: 'Tempestade solar', article: 'a', weight: 2, crisis: 'shield', requires: 'orbit',
    desc: 'o Enxame para e a solar cai à metade',
    effects: [{ type: 'output', gen: 'swarm', mult: 0 }, { type: 'output', gen: 'solar', mult: 0.5 }],
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
    steps: ['O cursor corre da esquerda para a direita.', 'Aperte ESPAÇO com ele dentro da faixa até completar os acertos.', 'Erros demais e a rede não volta.'],
  },
  valves: {
    title: 'Abrir as válvulas de alívio', game: 'mash',
    steps: [
      'Alterne ← e → para subir a pressão; ela vaza sozinha.',
      'Siga a faixa verde, que anda, até o alívio encher: no ritmo, sem pressa.',
      'Chegar a 100% estoura a válvula. Estouros demais e a crise está perdida.',
    ],
  },
  rewire: {
    title: 'Remanejar os circuitos', game: 'sequence',
    steps: [
      'Digite a sequência de setas mostrada, na ordem.',
      'Cada tecla errada é um erro; erros demais ou o tempo acabando = falha.',
      'Em crises de nível alto as setas somem após alguns segundos: memorize.',
    ],
  },
  contain: {
    title: 'Conter o campo magnético', game: 'balance',
    steps: [
      'O ponteiro deriva sozinho, empurrado por forças que mudam.',
      'Use ← e → para segurá-lo na faixa central até a contenção encher.',
      'Encostar na borda é uma ruptura. Rupturas demais e a crise está perdida.',
    ],
  },
  shield: {
    title: 'Proteger o Enxame', game: 'shield',
    steps: [
      'Erupções chegam pelas quatro direções, com a contagem na seta.',
      'Aperte a seta da direção antes que a contagem acabe para bloquear.',
      'Erupções que passam danificam o Enxame: impactos demais = falha.',
    ],
  },
};

// Dificuldade das crises: o nível vai de 0 (começo do jogo) a `maxLevel` e sobe 1 por
// ascensão. Desafios e semente do dia usam `runLevel` (igual para todo mundo), a não ser
// que a regra do desafio diga outro. Cada parâmetro dos minijogos é [nível 0, nível
// máximo], interpolado; inteiros são arredondados. O nível 0 é mais fácil que a 1.2 e o
// máximo pede atenção de verdade.
export const CRISIS = { maxLevel: 10, runLevel: 3 };

export const DIFFICULTY = {
  // speed: voltas por segundo; width: largura da faixa (fração da barra)
  timing: { speed: [0.45, 0.85], width: [0.25, 0.12], need: [3, 5], maxMisses: [3, 2], timeLeft: [20, 16] },
  // Pressão: cada seta alternada soma `gain`, e ela vaza `leak` por s. Ficar `hold` s
  // (somados) dentro da faixa de largura `band` resolve; chegar a 1 estoura. O ritmo
  // necessário é leak/gain apertos por s, então martelar as setas estoura a válvula.
  // A faixa (a meta) oscila em todos os níveis: amplitude `drift` e velocidade `driftSpeed`
  // (rad/s), pequenas e lentas no nível 0, maiores e rápidas no máximo.
  mash: {
    band: [0.35, 0.14], hold: [2.5, 6], gain: [0.1, 0.07], leak: [0.12, 0.3], maxBursts: [3, 2], timeLeft: [15, 15],
    drift: [0.07, 0.18], driftSpeed: [0.6, 1.4],
  },
  // Contenção: o ponteiro (-1 a 1) é empurrado por uma força que muda a cada 0.5 s, de
  // até `force`; cada seta dá `push` de velocidade. `zone`: meia-largura da faixa central.
  balance: { zone: [0.5, 0.25], hold: [4, 8], force: [0.8, 1.8], push: [0.35, 0.3], maxBreaches: [3, 2], timeLeft: [20, 18] },
  // Tempestade: uma erupção nova a cada `gap` s numa direção livre, com `warn` s para
  // bloquear; `need` bloqueios resolvem.
  shield: { need: [6, 12], warn: [2.4, 1.1], gap: [1.5, 0.6], maxHits: [3, 2], timeLeft: [20, 18] },
  // A partir do nível `hide.from`, as setas somem depois de `hide.value` s.
  sequence: { length: [5, 9], timeLeft: [14, 11], maxErrors: [3, 2], hide: { from: 6, value: [4, 2] } },
};

export const SCHEDULE = {
  first: 150,       // s de jogo até o primeiro evento (o começo é para aprender)
  gapMin: 60,       // intervalo entre eventos: sorteado em [gapMin, gapMax]
  gapMax: 180,
  crisisDeadline: 90, // sem ação nesse tempo, a equipe é chamada sozinha
};

// Danos de uma crise = o menor entre uma fração do dinheiro guardado e alguns segundos
// de renda: dói, mas nunca leva a poupança embora nem pune demais quem está ausente.
// Como os minijogos, sobem com o nível da crise: [nível 0, nível máximo].
export const DAMAGE = { moneyShare: [0.08, 0.25], incomeSeconds: [45, 300] };

// Resolver no braço sai de graça e ainda rende um bônus, mais longo nos níveis altos
// (`duration`: [nível 0, nível máximo] em segundos).
export const REWARD = { id: 'tuned', name: 'Rede afinada', duration: [45, 90], effects: [{ type: 'output', mult: 1.25 }] };
