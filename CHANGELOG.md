# Changelog

Todas as mudanças relevantes do Elden Grid ficam aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/): versão menor (1.x) para
conteúdo novo, patch (1.0.x) para correções. Cada versão lançada tem uma tag `vX.Y.Z`.

Cada PR que muda o jogo adiciona sua linha em **Não lançado**; ao lançar, a seção ganha
número e data. Mudanças de save registram a nova `saveVersion`.

## [Não lançado]

### Adicionado
- Aba **Mercado** (tecla `K`), entre Rede e Legado. Em 80 colunas a barra de abas mostra
  só o raio no lugar do título para caber.

## [1.4.0] - 2026-10-22

Fronteira: três fontes depois da antimatéria, duas crises novas e partidas que fecham na
Fronteira.

### Adicionado
- Páginas na aba Geradores: 10 fontes por página, com as teclas `0`–`9` valendo na página
  aberta e `←→` (ou `PgUp`/`PgDn`) para trocar. A segunda página aparece quando a
  primeira fonte dela é liberada.
- **Enxame Orbital**, a primeira fonte depois da antimatéria: espelhos em órbita,
  sem noite e com produção fixa, mas que só se compram na janela de lançamento (8 s a
  cada 40 s; a auto-compra espera a janela). Pesquisas: Espelhos em Órbita (libera),
  Enxame de Dyson (x2) e Foguetes Reutilizáveis (janela +8 s).
- **Kugelblitz**, um buraco negro artificial que precisa ser alimentado: rende a fração
  que as outras fontes conseguem sustentar (a produção delas sobre 60% da dele). Construir
  rápido demais, ou perder reatores num desligamento, derruba a alimentação. Pesquisas:
  Colapso Gravitacional (libera), Kugelblitz em Cascata (x2) e Acreção Controlada (precisa
  de metade da alimentação).
- **Energia do Vácuo**, a última fonte da Fronteira: produção instável que oscila rápido
  entre x0.2 e x5 (média ~x1.4). Pesquisas: Flutuação do Vácuo (libera), Efeito Casimir
  Dinâmico (x2) e Volantes de Inércia (a produção nunca cai abaixo de x1).
- Mais seis pesquisas no fim da árvore (45 no total): Armazenamento em Rede e Baterias de
  Estado Sólido (o excedente da rede passa a valer 40% e depois 60% do preço), Rede
  Orbital (capacidade x1000), Antimatéria Catalisada (x2), Economia Pós-Escassez (produção
  x3) e Inteligência Planetária (pesquisa x3).
- Duas crises novas com minijogos próprios, já com os níveis de dificuldade:
  - **Ruptura de contenção** (com antimatéria ou Kugelblitz): um ponteiro deriva com
    forças que mudam, e ← → o seguram na faixa central até a contenção encher.
  - **Tempestade solar** (com o Enxame): erupções chegam pelas quatro direções e a seta
    certa a tempo bloqueia cada uma.
- Cinco conquistas novas (102 no total): uma para cada fonte da Fronteira e uma para cada
  crise nova vencida rápido.
- Árvore de pesquisa: ramos muito fundos empurram a coluna do custo em vez de passar da
  largura da tela.

### Mudado
- Da 4ª ascensão em diante, a partida só fecha com a Energia do Vácuo (ou todas as
  pesquisas); as três primeiras continuam fechando na antimatéria. A aba Legado mostra as
  condições da fase atual.
- Pontos de legado pela raiz cúbica do total ganho (antes, raiz quadrada), com a 1ª
  ascensão ainda em ~20 pontos. Com a raiz quadrada, a primeira partida até a Fronteira
  dava 100x mais pontos que a anterior. Save **v11**: quem já ascendeu mantém os pontos, e
  o total ganho é reajustado para o próximo ponto vir no ritmo da curva nova.

- Metas dos desafios nos níveis III a V subiram para $1T, $30T e $1Q: com a Fronteira, o
  nível V estava saindo 1 h mais rápido que o calibrado.
- Rede Planetária mais barata (60k PP) e Rede Orbital com capacidade x1000: com o legado
  forte, a rede passava 70% do tempo saturada nas partidas da Fronteira.

## [1.3.0] - 2026-10-16

Pressão: partidas mais longas e crises que endurecem a cada ascensão.

### Mudado
- Ascender agora fecha uma partida completa: além de $25B ganhos na partida, é preciso
  ter uma usina de antimatéria ou concluir todas as pesquisas. A aba Legado mostra as
  condições com o que falta. Ficar mais tempo na partida continua rendendo mais pontos.
- Crises têm nível de dificuldade, de 0 a 10, que sobe 1 por ascensão. O nível 0 é mais
  fácil que antes; nos altos a faixa do timing estreita, a sequência fica mais longa e
  some da tela depois de alguns segundos. O nível aparece no manual de crise.
- Válvulas de alívio (onda de calor) com regra nova: em vez de encher a barra martelando
  ← →, é preciso segurar a pressão numa faixa verde no ritmo; chegar a 100% estoura a
  válvula. Nos níveis altos a faixa oscila. A conquista Pistão Humano passou a pedir as
  válvulas abertas em até 5 s.
- O custo de falhar ou chamar a equipe sobe com o nível da crise: de 8% do caixa ou 45 s
  de renda (nível 0) até 25% do caixa ou 5 min de renda (nível 10). O bônus Rede afinada
  dura de 45 s a 90 s, conforme o nível.
- Desafios e semente do dia têm crises de nível fixo 3, igual para todos; no Apagão
  Eterno o nível sobe com o desafio (I = 3 … V = 10).
- Seguro de Rede nível 3 reduz o dano das crises a 35%, em vez de zerá-lo.
- Loja do legado rebalanceada para o novo ritmo de pontos: os níveis mais caros de cada
  item custam ~1.5x mais. No simulador, a 1ª ascensão sai em ~1 h com ~20 pontos e a
  loja completa em ~17 h.

## [1.2.0] - 2026-10-16

Desafios: partidas com regras próprias, recompensas que se acumulam e a semente do dia.

### Adicionado
- Versão do jogo na tela de título e em Opções.
- Aviso de atualização: uma vez por dia, em segundo plano, o jogo procura a última tag no
  GitHub e avisa no título quando há versão nova. Sem internet ou com timeout (3 s),
  nada trava nem muda. Desliga em Opções → Checar atualizações ou com
  `ELDEN_GRID_NO_UPDATE_CHECK=1`.
- Item **Atualizar** no título (só com versão nova): num clone git limpo na `main`, roda
  `git pull --ff-only` depois de confirmar; em qualquer outro caso, mostra como
  atualizar à mão. Os saves nunca são tocados.
- Desafios (menu → Desafios): cinco partidas com regras próprias, jogadas num slot
  separado (D), do zero e sem legado, sem tocar nos slots 1–3. Apagão Eterno (eventos e
  crises sem parar, sem bônus por vitória), Sem Vento (sem eólica, hidrelétrica nem
  manivela, e os reatores esquentam mais), Rede Velha (capacidade pesquisada rende
  menos), Mercado em Queda (o kWh perde valor com o tempo) e Combustível Caro (usinas a
  combustível rendem bem menos). Cada um tem 5 níveis, com
  metas de $25B a $10T ganhos na partida e regras mais duras; o melhor tempo de cada
  nível fica registrado. Desafios não têm ascensão nem progresso offline.
- Recompensas dos desafios, nos slots 1–3: cada nível completo multiplica a produção por
  1.1 (os 25 níveis dão x10.8) e soma a vantagem do desafio: mais prazo nas crises
  (Equipe de Plantão), solar mais forte e já pesquisada (Brisa Solar), mais capacidade
  na rede (Rede Robusta), kWh mais caro (Contratos Futuros) e operação mais barata
  (Eficiência Térmica).
- Semente do dia (menu → Desafios, última linha): a data define a seed da partida e
  sorteia 1 ou 2 regras de desafio; todo mundo que joga no mesmo dia recebe a mesma
  partida. Meta de $25B, contando só o tempo com o jogo aberto. Ao terminar, o jogo
  guarda o recorde do dia e mostra um código (ex.: `EG-1016-38:12-K7Q`) para comparar
  com os amigos.
- 15 conquistas de desafio numa categoria nova (97 no total): níveis completos, todos os
  desafios, nível V de cada um e sequências e tempos da semente do dia.

### Alterado
- `scripts/simulate.js --challenge=<id> --tier=N` e `--daily=AAAA-MM-DD` jogam a partida
  especial e mostram o tempo até a meta; os desafios foram calibrados com eles.
- Perfil compartilhado entre os slots em `~/.elden-grid/profile.json` (níveis de desafio
  e recordes), com escrita atômica e backup como os saves.
- Save v10 (`state.run`: marca a partida como desafio ou semente do dia).

## [1.1.0] - 2026-10-16

Herança: o legado ganha teto infinito e a partida longa ganha metas.

### Adicionado
- Conquistas: 82 metas em oito categorias (8 secretas). Cada uma dá +1% de produção
  permanente e sobrevive à ascensão. Aviso no rodapé ao conquistar e lista com o
  progresso de cada uma na aba Estatísticas (tecla `V`).
- Loja do legado maior, com preços que chegam a dezenas de milhares de pontos:
  - níveis 4 e 5 que tiram o atrito do começo da partida: Começo Rápido traz alta
    tensão, solar, hidrelétrica, biomassa e gás prontos; Bolsas de Pesquisa, até 25
    laboratórios; Manivela de Ouro gira sozinha nos 5 minutos iniciais; Contratos de
    Obra estendem o desconto a resfriamento e transformadores; Turno da Noite vai a 24 h
    a 90%;
  - cinco itens novos: Pesquisa Herdada, Engenharia Térmica, Seguro de Rede, Marcos
    Antecipados e Rede Herdada.
- A loja do legado rola sob o cabeçalho de pontos e ascensão.
- Monumento: compra sem teto no fim da loja do legado. Cada nível multiplica a produção
  por 1.1 e custa o dobro do anterior; com muitos pontos, passa a valer mais que
  guardá-los.

### Alterado
- A capacidade da rede cresce junto com os bônus permanentes (pontos de legado,
  Monumento e conquistas). Quem tinha muito legado começava a partida com a rede
  saturada em mais de 1000%, vendendo quase tudo com desconto.
- O desconto dos Contratos de Obra vale também para os laboratórios.
- `scripts/simulate.js` usa a loja nova e o Monumento e mostra quando a loja fica
  completa, o nível do Monumento, as partidas curtas e as conquistas.
- Save v9 (`achievements`, `legacy.monument`, `auto.crank`). Saves antigos migram
  sozinhos e recebem no primeiro quadro as conquistas que já cumpriam.

## [1.0.1] - 2026-10-16

### Adicionado
- Modo disfarce: `\` troca a tela, de qualquer lugar do jogo, por testes rodando, o log
  de um servidor ou um terminal vazio (escolha em Opções → Disfarce). Esconder salva o
  jogo, que segue produzindo com eventos e crises em pausa; ao voltar, um resumo mostra
  quanto rendeu.
- Este `CHANGELOG.md` e tags de versão no git (`v1.0.0`, `v1.0.1`).

### Corrigido
- Windows: o console passa para UTF-8 enquanto o jogo roda e volta ao original ao sair,
  então os símbolos Unicode deixam de aparecer quebrados.

## [1.0.0] - 2026-10-14

Primeira versão pública.

### Adicionado
- Dez fontes de energia com comportamento próprio (vento, dia e noite, reservatório,
  maré, custo de operação, calor dos reatores).
- Árvore de 30 pesquisas paga com PP do laboratório, incluindo auto-compra.
- Rede de transmissão com capacidade, transformadores e quatro visões (mapa, fluxo,
  gráfico e calor).
- 5 upgrades por fonte, marcos em 25/50/100 unidades e compra em lote.
- Eventos aleatórios com seed e crises interativas (blecaute, onda de calor,
  sobrecarga) resolvidas por minijogos.
- Legado: ascensão a partir de $25B, pontos com +10% de produção e loja de vantagens.
- Progresso offline, estatísticas da partida e da carreira.
- Três slots de save com escrita atômica, backup, migração e exportação em texto.
- Tela de opções (animações, fps, Unicode/ASCII, cores, formato de números, autosave)
  e tela de título temática.
- Simulador de balanceamento (`npm run simulate`).
- Licença PolyForm Noncommercial 1.0.0.

[Não lançado]: https://github.com/localhost-ayu/elden-grid/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/localhost-ayu/elden-grid/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/localhost-ayu/elden-grid/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/localhost-ayu/elden-grid/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/localhost-ayu/elden-grid/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/localhost-ayu/elden-grid/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/localhost-ayu/elden-grid/releases/tag/v1.0.0
