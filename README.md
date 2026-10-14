# Elden Grid

Idle game de geração de energia que roda inteiro no terminal. Você começa girando uma
manivela e comprando uma turbina eólica, e termina administrando uma rede com reatores de
fusão, antimatéria, crises para apagar e um legado que atravessa partidas.

```
 ⚡ ELDEN GRID    Geradores │ Pesquisa │ Rede │ Legado │ Estatísticas │ Opções
 Dinheiro $1.30B  Produção 17.13M kW  Total 56.03B kWh  Preço $1.92/kWh ▲
 Renda $32.95M/s  PP 12.39k (+21.0/s)  Rede 87%  ☼ 10h  ⟳ auto  ✦ +30%
 ── ⚠ BLECAUTE REGIONAL · [X] manual de crise · equipe em 1:12 ──────────────
    \   /        \o/     ~~~~~|         .           o    .         )
      O        _______   ~~~~~|,        o           O    o        '
    / | \     /_/_/_/*/  ~~~~~| .       ||         | |  | |      /^\
      |      /_/_/_/_/   ~~~~~|  ~    _||______   _| |__| |_   _/   \_
     /_\        |   |    =====|__~~~ |{&}|_|{&}| |__GAS____| =====H=====
 Eólica      Solar       Hidro       Biomassa    Gás         Geotérmica
 x42         x30   nv1/5 x25   nv2/5 x18   nv3/5 x12   nv4/5 x9    nv5/5
```

O nome é uma paródia de *Elden Ring*, e a tela de título brinca com isso; o jogo não tem
nenhuma relação com a FromSoftware ou a Bandai Namco. Ele nasceu como um clone de
*Reactor – Energy Sector Tycoon* e foi crescendo até virar outro jogo.

## Como funciona

- **Energia vira dinheiro sozinha.** Cada usina produz kW; a energia é vendida a um preço
  que oscila (▲/▼ mostram a tendência). Convenção: 1 s real = 1 h de jogo.
- **Dez fontes, cada uma com personalidade.** A eólica segue o vento, a solar o dia e a
  noite, a maremotriz a maré, a hidrelétrica o reservatório; gás e fusão têm custo de
  operação; nuclear, fusão e antimatéria esquentam e podem desligar se ninguém resfriar.
- **Pesquisa destrava o resto.** Laboratórios geram Pontos de Pesquisa (PP) para uma árvore
  de 30 techs: novas fontes, multiplicadores, capacidade da rede e auto-compra.
- **A rede é o gargalo.** Acima da capacidade de transmissão, o excedente vale só 25% do
  preço. A aba Rede mostra a rede em quatro visões (mapa, fluxo, gráfico e calor).
- **Upgrades e marcos.** Cada fonte tem 5 upgrades e dobra a produção ao chegar a 25, 50
  e 100 unidades. Compras em lote x1, x10, x100 ou MAX.
- **Eventos e crises.** Tempestades, picos de demanda e descobertas mudam o jogo por um
  tempo. Crises (blecaute, onda de calor, sobrecarga) ficam ativas até alguém agir: o
  manual de crise explica o minijogo de cada uma. Resolver sai de graça e dá um bônus;
  falhar, chamar a equipe ou ignorar custa o menor entre 10% do caixa e 1 min de renda.
- **Legado.** Depois de ganhar $25B numa partida dá para ascender: a partida recomeça e
  você recebe pontos (+10% de produção cada ponto guardado) que podem ser trocados por
  vantagens permanentes na loja do legado.
- **Progresso offline.** Ao voltar, o jogo credita até 1 h fora (mais com o legado) a 50%
  da produção e mostra um resumo.

## Requisitos

Nenhuma dependência: só módulos nativos do Node. Precisa de **Node.js 18+** ou
**[Bun](https://bun.sh)**, num terminal interativo de pelo menos **80×24**. Funciona em
Linux, macOS e Windows Terminal/WSL.

## Rodando

```sh
npm start              # ou: bun index.js
npm test               # ou: bun test
npm run simulate       # ou: bun scripts/simulate.js 90 --seeds=5
```

`scripts/simulate.js` joga sozinho usando só a lógica do jogo e imprime quando chegou a
cada marco (primeira solar, nuclear, fusão, cada ascensão), as crises e quanto tempo a rede
passou saturada. Opções: `[minutos] --seeds=N --runs=N --crises=play|idle|off`.

## Controles

| Onde | Teclas |
|---|---|
| Em qualquer aba | `G` `P` `R` `L` `E` `O` (ou `Tab`/`Shift+Tab`) trocam de aba · `espaço` gira a manivela · `X` abre o manual de crise · `M`/`Esc` menu (salva) · `Q` sai (salva) |
| Geradores | `↑↓` + `Enter` ou `0`–`9` compram · `B` lote · `U` upgrade · `A` auto-compra · `V` cena das usinas |
| Pesquisa | `↑↓` `PgUp` `PgDn` + `Enter` pesquisa |
| Rede | `V` muda a visão · `T` transformador · `↑↓` + `C` resfriamento |
| Legado | `↑↓` + `Enter` ascende ou compra na loja (com confirmação `S`/`N`) |
| Estatísticas | `↑↓` `PgUp` `PgDn` `Home` `End` |
| Opções | `↑↓` escolhe, `←→`/`Enter` muda |

## Saves e opções

Tudo fica em `~/.elden-grid/`, fora do repositório (saves da época em que o jogo se
chamava Reactor ASCII, em `~/.reactor-ascii/`, são movidos para lá na primeira execução):

- `slot1.json` … `slot3.json` (e `.bak`): três saves. A gravação é atômica (`.tmp` +
  `rename`) e um save corrompido é recuperado do backup sem derrubar o jogo. Saves de
  versões antigas são migrados degrau por degrau (`saveVersion`).
- `settings.json`: animações (ligadas, reduzidas, desligadas), 5/10/15 fps, símbolos
  Unicode ou ASCII puro, cores 256/16/sem cor, números curtos ou científicos e intervalo
  do autosave. A variável de ambiente `NO_COLOR` desliga as cores.
- `export-slotN.txt` / `import.txt`: o save em uma linha de texto (Base64), para levar
  para outra máquina. A exportação também tenta copiar o texto para a área de
  transferência do terminal (OSC 52).

## Arquitetura

```
index.js            liga terminal, storage e app; loop de quadros e autosave
src/data/           só números e textos de balanceamento (fontes, pesquisa, eventos…)
src/core/           regras do jogo, puras e determinísticas (sem terminal, sem disco)
src/storage/        saves em slots, escrita atômica, migração, opções, exportação
src/ui/             tudo que toca o terminal: renderer, teclado, tema, telas, arte ASCII
scripts/            simulação de balanceamento
test/               node:test, sem dependências
```

Algumas escolhas que guiam o código:

- **`data/` e `core/` não conhecem o terminal.** Um teste falha se algum deles importar
  `fs`, `readline` ou escrever ANSI. É isso que permite testar tudo sem TTY, simular
  horas de jogo em segundos e, no futuro, levar a mesma lógica para uma versão web. Os
  minijogos das crises seguem a mesma regra: são máquinas de estado puras, a UI só
  desenha.
- **Bônus por composição.** Pesquisas, upgrades, marcos, legado e eventos viram
  modificadores multiplicados entre si, em vez de `if` por fonte espalhado pelo código.
- **Sorte com seed.** Os eventos usam um gerador pseudoaleatório cujo estado fica no
  save: a mesma partida sorteia os mesmos eventos, e os testes são reproduzíveis.
- **Renderização por diferença.** As telas devolvem linhas de texto; o `screen.js` as
  transforma numa grade de células e envia só o que mudou desde o quadro anterior. Sem
  flicker e com poucos bytes por quadro, o que conta em SSH.
- **O terminal sempre volta ao normal**, inclusive em `Ctrl+C`, `SIGTERM`, janela fechada
  ou erro não tratado (que ainda tenta salvar antes de sair).

Para adicionar uma fonte de energia, um evento ou uma pesquisa, quase sempre basta editar
`src/data/`: os testes de consistência dos dados avisam se faltar alguma peça (arte da
fonte, pesquisa que a destrava, símbolo sem equivalente ASCII).
