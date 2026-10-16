# Changelog

Todas as mudanças relevantes do Elden Grid ficam aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/): versão menor (1.x) para
conteúdo novo, patch (1.0.x) para correções. Cada versão lançada tem uma tag `vX.Y.Z`.

Cada PR que muda o jogo adiciona sua linha em **Não lançado**; ao lançar, a seção ganha
número e data. Mudanças de save registram a nova `saveVersion`.

## [Não lançado]

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

[Não lançado]: https://github.com/localhost-ayu/elden-grid/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/localhost-ayu/elden-grid/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/localhost-ayu/elden-grid/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/localhost-ayu/elden-grid/releases/tag/v1.0.0
