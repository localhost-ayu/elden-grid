# Changelog

Todas as mudanças relevantes do Elden Grid ficam aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/): versão menor (1.x) para
conteúdo novo, patch (1.0.x) para correções. Cada versão lançada tem uma tag `vX.Y.Z`.

Cada PR que muda o jogo adiciona sua linha em **Não lançado**; ao lançar, a seção ganha
número e data. Mudanças de save registram a nova `saveVersion`.

## [Não lançado]

### Adicionado
- Conquistas: 80 metas em oito categorias (8 secretas). Cada uma dá +1% de produção
  permanente e sobrevive à ascensão. Aviso no rodapé ao conquistar e lista com o
  progresso de cada uma na aba Estatísticas (tecla `V`).

### Alterado
- Save v9 (`state.achievements`). Saves antigos migram sozinhos e recebem no primeiro
  quadro as conquistas que já cumpriam.

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

[Não lançado]: https://github.com/localhost-ayu/elden-grid/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/localhost-ayu/elden-grid/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/localhost-ayu/elden-grid/releases/tag/v1.0.0
