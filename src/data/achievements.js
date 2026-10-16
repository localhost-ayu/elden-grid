// Conquistas: metas permanentes do save (sobrevivem à ascensão). Cada uma dá
// +ACHIEVEMENT_BONUS de produção, somado: pouco por conquista, muito no conjunto.
//
// Condições são declarativas, interpretadas em src/core/achievements.js. Toda condição
// vira um progresso (0 = longe, 1 = conquistada), que a tela mostra como porcentagem.
//   career  key, at   ficha da carreira (key aceita "a.b", ex.: 'crises.won')
//   run     key, at   ficha desta partida
//   sum     key, at   soma de um mapa da carreira (eventos vistos, desligamentos...)
//   owned   gen, at   unidades de uma fonte nesta partida ('any' = a fonte com mais)
//   ownedAll at       todas as fontes com pelo menos `at` unidades
//   tech    tech      pesquisa concluída nesta partida
//   techs   at        quantas pesquisas nesta partida
//   upgradesMax at    fontes com a trilha de upgrades completa
//   transformers at   transformadores nesta partida
//   coolingMax        algum reator com o resfriamento máximo
//   heat    at        algum reator com calor >= at sem estar desligado
//   power / income / gridLoad / money  at   valor atual
//   legacy  key, at   s.legacy[key] (ascensions, earned)
//   shopMax at        itens da loja do legado no nível máximo
//   fastest at        partida mais rápida até ascender <= at segundos
//   fastWin game, at  melhor vitória num minijogo <= at segundos
//   without key, at   ganhar $at nesta partida com a ficha `key` da partida ainda em 0
//   count   at        outras conquistas
// `secret`: nome e descrição ficam ocultos até conquistar.
import { GENERATORS } from './generators.js';
import { TECHS } from './research.js';
import { SHOP } from './legacy.js';

export const ACHIEVEMENT_BONUS = 0.01;

export const CATEGORIES = [
  { id: 'energy', name: 'Energia' },
  { id: 'sources', name: 'Fontes' },
  { id: 'research', name: 'Pesquisa' },
  { id: 'grid', name: 'Rede e reatores' },
  { id: 'crises', name: 'Crises' },
  { id: 'legacy', name: 'Legado' },
  { id: 'crank', name: 'Manivela e tempo' },
  { id: 'secret', name: 'Segredos' },
];

export const ACHIEVEMENTS = [
  // ---- energia ----
  { id: 'a_mwh', cat: 'energy', name: 'Primeira Faísca', desc: 'produza 1 MWh (1.000 kWh)', type: 'career', key: 'energy', at: 1e3 },
  { id: 'a_gwh', cat: 'energy', name: 'Gigawatt-hora', desc: 'produza 1 GWh no total', type: 'career', key: 'energy', at: 1e6 },
  { id: 'a_twh', cat: 'energy', name: 'Terawatt-hora', desc: 'produza 1 TWh no total', type: 'career', key: 'energy', at: 1e9 },
  { id: 'a_pwh', cat: 'energy', name: 'Petawatt-hora', desc: 'produza 1 PWh no total', type: 'career', key: 'energy', at: 1e12 },
  { id: 'a_ewh', cat: 'energy', name: 'Exawatt-hora', desc: 'produza 1 EWh no total', type: 'career', key: 'energy', at: 1e15 },
  { id: 'a_zwh', cat: 'energy', name: 'Zettawatt-hora', desc: 'produza 1 ZWh no total', type: 'career', key: 'energy', at: 1e18 },
  { id: 'a_m1', cat: 'energy', name: 'Primeiro Milhão', desc: 'ganhe $1M no total', type: 'career', key: 'moneyEarned', at: 1e6 },
  { id: 'a_b1', cat: 'energy', name: 'Bilionário da Energia', desc: 'ganhe $1B no total', type: 'career', key: 'moneyEarned', at: 1e9 },
  { id: 'a_t1', cat: 'energy', name: 'Trilionário', desc: 'ganhe $1T no total', type: 'career', key: 'moneyEarned', at: 1e12 },
  { id: 'a_q1', cat: 'energy', name: 'PIB de um País', desc: 'ganhe $1 quatrilhão no total', type: 'career', key: 'moneyEarned', at: 1e15 },
  { id: 'a_qi1', cat: 'energy', name: 'Dinheiro Demais', desc: 'ganhe $1 quintilhão no total', type: 'career', key: 'moneyEarned', at: 1e18 },
  { id: 'a_mw', cat: 'energy', name: 'Um Megawatt', desc: 'chegue a 1.000 kW de produção', type: 'career', key: 'peakKw', at: 1e3 },
  { id: 'a_gw', cat: 'energy', name: 'Um Gigawatt', desc: 'chegue a 1 GW de produção', type: 'career', key: 'peakKw', at: 1e6 },
  { id: 'a_tw', cat: 'energy', name: 'Um Terawatt', desc: 'chegue a 1 TW de produção', type: 'career', key: 'peakKw', at: 1e9 },
  { id: 'a_pw', cat: 'energy', name: 'Um Petawatt', desc: 'chegue a 1 PW de produção', type: 'career', key: 'peakKw', at: 1e12 },
  { id: 'a_inc', cat: 'energy', name: 'Um Milhão por Segundo', desc: 'renda de $1M/s', type: 'career', key: 'peakIncome', at: 1e6 },

  // ---- fontes ----
  { id: 'a_wind100', cat: 'sources', name: 'Ventania', desc: '100 turbinas eólicas numa partida', type: 'owned', gen: 'wind', at: 100 },
  { id: 'a_fusion', cat: 'sources', name: 'Sol na Garrafa', desc: 'construa um reator de fusão', type: 'owned', gen: 'fusion', at: 1 },
  { id: 'a_anti', cat: 'sources', name: 'Aniquilação', desc: 'construa uma usina de antimatéria', type: 'owned', gen: 'antimatter', at: 1 },
  { id: 'a_nuc100', cat: 'sources', name: 'Centenário Nuclear', desc: '100 reatores nucleares numa partida', type: 'owned', gen: 'nuclear', at: 100 },
  { id: 'a_any250', cat: 'sources', name: 'Monocultura', desc: '250 unidades de uma mesma fonte', type: 'owned', gen: 'any', at: 250 },
  { id: 'a_all1', cat: 'sources', name: 'Coleção Completa', desc: 'tenha as 10 fontes na mesma partida', type: 'ownedAll', at: 1 },
  { id: 'a_all25', cat: 'sources', name: 'Frota', desc: '25 unidades de cada fonte', type: 'ownedAll', at: 25 },
  { id: 'a_all100', cat: 'sources', name: 'Império', desc: '100 unidades de cada fonte', type: 'ownedAll', at: 100 },
  { id: 'a_upg1', cat: 'sources', name: 'Melhoria Contínua', desc: 'compre um upgrade', type: 'career', key: 'upgrades', at: 1 },
  { id: 'a_upgmax', cat: 'sources', name: 'Trilha Completa', desc: 'todos os upgrades de uma fonte', type: 'upgradesMax', at: 1 },
  { id: 'a_upgall', cat: 'sources', name: 'Tudo no Máximo', desc: 'todos os upgrades de todas as fontes', type: 'upgradesMax', at: GENERATORS.length },
  { id: 'a_mile1', cat: 'sources', name: 'Marco Zero', desc: 'atinja um marco de quantidade', type: 'career', key: 'milestones', at: 1 },
  { id: 'a_mile100', cat: 'sources', name: 'Colecionador de Marcos', desc: '100 marcos no total', type: 'career', key: 'milestones', at: 100 },

  // ---- pesquisa ----
  { id: 'a_tech1', cat: 'research', name: 'Eureka', desc: 'conclua uma pesquisa', type: 'career', key: 'techs', at: 1 },
  { id: 'a_tech15', cat: 'research', name: 'Cientista', desc: '15 pesquisas numa partida', type: 'techs', at: 15 },
  { id: 'a_techall', cat: 'research', name: 'Árvore Completa', desc: 'todas as pesquisas numa partida', type: 'techs', at: TECHS.length },
  { id: 'a_labs50', cat: 'research', name: 'Campus', desc: '50 laboratórios numa partida', type: 'run', key: 'labsBought', at: 50 },
  { id: 'a_auto2', cat: 'research', name: 'IA no Comando', desc: 'pesquise Gestão por IA', type: 'tech', tech: 't_auto2' },
  { id: 'a_planet', cat: 'research', name: 'Rede Planetária', desc: 'pesquise a Rede Planetária', type: 'tech', tech: 't_planetary' },

  // ---- rede e reatores ----
  { id: 'a_tr1', cat: 'grid', name: 'Gambiarra Oficial', desc: 'compre um transformador', type: 'career', key: 'transformers', at: 1 },
  { id: 'a_tr6', cat: 'grid', name: 'Subestação Própria', desc: '6 transformadores numa partida', type: 'transformers', at: 6 },
  { id: 'a_jam', cat: 'grid', name: 'Engarrafamento', desc: 'rede a 500% da capacidade', type: 'gridLoad', at: 5 },
  { id: 'a_excess', cat: 'grid', name: 'Liquidação', desc: 'venda 1 TWh com a rede saturada', type: 'career', key: 'excessEnergy', at: 1e9 },
  { id: 'a_price', cat: 'grid', name: 'Hora de Ponta', desc: 'venda o kWh a $2.50 ou mais', type: 'career', key: 'peakPrice', at: 2.5 },
  { id: 'a_cool1', cat: 'grid', name: 'Torre de Resfriamento', desc: 'instale um resfriamento', type: 'career', key: 'cooling', at: 1 },
  { id: 'a_coolmax', cat: 'grid', name: 'Zero Absoluto', desc: 'resfriamento máximo num reator', type: 'coolingMax' },

  // ---- crises ----
  { id: 'a_win1', cat: 'crises', name: 'Plantão', desc: 'vença uma crise', type: 'career', key: 'crises.won', at: 1 },
  { id: 'a_win25', cat: 'crises', name: 'Bombeiro', desc: 'vença 25 crises', type: 'career', key: 'crises.won', at: 25 },
  { id: 'a_win100', cat: 'crises', name: 'Herói da Rede', desc: 'vença 100 crises', type: 'career', key: 'crises.won', at: 100 },
  { id: 'a_win500', cat: 'crises', name: 'Lenda do Apagão', desc: 'vença 500 crises', type: 'career', key: 'crises.won', at: 500 },
  { id: 'a_streak10', cat: 'crises', name: 'Em Série', desc: '10 crises vencidas seguidas', type: 'career', key: 'bestStreak', at: 10 },
  { id: 'a_streak25', cat: 'crises', name: 'Imparável', desc: '25 crises vencidas seguidas', type: 'career', key: 'bestStreak', at: 25 },
  { id: 'a_timing', cat: 'crises', name: 'Reflexos', desc: 'religue a rede em até 3 s', type: 'fastWin', game: 'timing', at: 3 },
  { id: 'a_mash', cat: 'crises', name: 'Pistão Humano', desc: 'abra as válvulas em até 2 s', type: 'fastWin', game: 'mash', at: 2 },
  { id: 'a_seq', cat: 'crises', name: 'Dedos Rápidos', desc: 'remaneje os circuitos em até 2,5 s', type: 'fastWin', game: 'sequence', at: 2.5 },
  { id: 'a_events', cat: 'crises', name: 'Já Vi de Tudo', desc: 'presencie 100 eventos', type: 'sum', key: 'events', at: 100 },
  { id: 'a_crew', cat: 'crises', name: 'Terceirizado', desc: 'pague $1B às equipes de crise', type: 'career', key: 'crewPaid', at: 1e9 },
  { id: 'a_timeout', cat: 'crises', name: 'Não É Comigo', desc: 'deixe 10 crises para a equipe', type: 'career', key: 'crises.timeout', at: 10 },

  // ---- legado ----
  { id: 'a_asc1', cat: 'legacy', name: 'Renascimento', desc: 'ascenda pela primeira vez', type: 'legacy', key: 'ascensions', at: 1 },
  { id: 'a_asc5', cat: 'legacy', name: 'Veterano', desc: '5 ascensões', type: 'legacy', key: 'ascensions', at: 5 },
  { id: 'a_asc10', cat: 'legacy', name: 'Dinastia', desc: '10 ascensões', type: 'legacy', key: 'ascensions', at: 10 },
  { id: 'a_asc25', cat: 'legacy', name: 'Linhagem', desc: '25 ascensões', type: 'legacy', key: 'ascensions', at: 25 },
  { id: 'a_asc50', cat: 'legacy', name: 'Eterno Retorno', desc: '50 ascensões', type: 'legacy', key: 'ascensions', at: 50 },
  { id: 'a_pts10', cat: 'legacy', name: 'Herdeiro', desc: 'receba 10 pontos de legado', type: 'legacy', key: 'earned', at: 10 },
  { id: 'a_pts100', cat: 'legacy', name: 'Fortuna de Família', desc: 'receba 100 pontos de legado', type: 'legacy', key: 'earned', at: 100 },
  { id: 'a_pts500', cat: 'legacy', name: 'Legado Lendário', desc: 'receba 500 pontos de legado', type: 'legacy', key: 'earned', at: 500 },
  { id: 'a_fast30', cat: 'legacy', name: 'Pressa', desc: 'ascenda em até 30 min de partida', type: 'fastest', at: 1800 },
  { id: 'a_fast15', cat: 'legacy', name: 'Relâmpago', desc: 'ascenda em até 15 min de partida', type: 'fastest', at: 900 },
  { id: 'a_shop1', cat: 'legacy', name: 'Investidor', desc: 'um item da loja do legado no máximo', type: 'shopMax', at: 1 },
  { id: 'a_mon1', cat: 'legacy', name: 'Pedra Fundamental', desc: 'erga o primeiro nível do Monumento', type: 'legacy', key: 'monument', at: 1 },
  { id: 'a_mon25', cat: 'legacy', name: 'Maravilha do Mundo', desc: 'Monumento no nível 25', type: 'legacy', key: 'monument', at: 25 },
  { id: 'a_shopall', cat: 'legacy', name: 'Loja Esvaziada', desc: 'toda a loja do legado no máximo', type: 'shopMax', at: SHOP.length },

  // ---- manivela e tempo ----
  { id: 'a_crank100', cat: 'crank', name: 'Braço Forte', desc: 'gire a manivela 100 vezes', type: 'career', key: 'cranks', at: 100 },
  { id: 'a_crank10k', cat: 'crank', name: 'Tendinite', desc: 'gire a manivela 10.000 vezes', type: 'career', key: 'cranks', at: 1e4 },
  { id: 'a_burst', cat: 'crank', name: 'Ritmo', desc: '10 giros da manivela em 1 s', type: 'career', key: 'crankBurst', at: 10 },
  { id: 'a_crankm', cat: 'crank', name: 'Manivela Milionária', desc: 'ganhe $1M só com a manivela', type: 'career', key: 'crankMoney', at: 1e6 },
  { id: 'a_offline', cat: 'crank', name: 'Dorminhoco', desc: '8 h de progresso offline no total', type: 'career', key: 'offlineTime', at: 8 * 3600 },
  { id: 'a_play10', cat: 'crank', name: 'Maratona', desc: '10 h de jogo no total', type: 'career', key: 'playTime', at: 10 * 3600 },

  // ---- segredos ----
  { id: 'a_delorean', cat: 'secret', secret: true, name: '1,21 Gigawatts!', desc: 'produza 1,21 GW de uma vez', type: 'power', at: 1.21e6 },
  { id: 'a_nowind', cat: 'secret', secret: true, name: 'Calmaria', desc: '$1B numa partida sem comprar eólicas', type: 'without', key: 'bought.wind', at: 1e9 },
  { id: 'a_nocrank', cat: 'secret', secret: true, name: 'Mãos Limpas', desc: '$25B numa partida sem a manivela', type: 'without', key: 'cranks', at: 2.5e10 },
  { id: 'a_nolab', cat: 'secret', secret: true, name: 'Ludita', desc: '$1M numa partida sem laboratório', type: 'without', key: 'labsBought', at: 1e6 },
  { id: 'a_edge', cat: 'secret', secret: true, name: 'No Limite', desc: 'reator a 97% do calor sem desligar', type: 'heat', at: 0.97 },
  { id: 'a_meltdown', cat: 'secret', secret: true, name: 'Isso Não Devia Acontecer', desc: 'deixe um reator superaquecer', type: 'sum', key: 'shutdowns', at: 1 },
  { id: 'a_rich', cat: 'secret', secret: true, name: 'Tio Patinhas', desc: 'tenha $1T guardado de uma vez', type: 'money', at: 1e12 },
  { id: 'a_count50', cat: 'secret', secret: true, name: 'Colecionador', desc: 'desbloqueie 50 conquistas', type: 'count', at: 50 },
];
