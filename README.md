# Elden Grid

Idle game de geração de energia que roda inteiro no terminal. Você começa girando uma
manivela para atender um bairro e sobe a escala de Kardashev até o Tipo III: de cidade a
país, do planeta ao Sistema Solar e dele à galáxia, com crises para apagar, um mercado
vivo e um legado que atravessa partidas.

```
 ⚡   Geradores │ Pesquisa │ Rede │ Mercado │ Legado │ Estatísticas │ Opções
 Dinheiro $1.30B  Produção 17.13M kW K0.42  Total 56.03B kWh  Preço $1.92/kWh ▲
 Renda $32.95M/s  PP 12.39k (+21.0/s)  Estado 87%  ☼ 10h  ⟳ auto  ✦ +30%
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
- **Escala de Kardashev.** O cabeçalho mostra o K da produção, na fórmula de Carl Sagan
  com os watts reais: um bairro é K 0, um país ~0.6, o planeta inteiro é o **Tipo I**, o
  Sol o **Tipo II** e a galáxia o **Tipo III**. Chegar ao Tipo III é o fim do jogo (que
  depois continua em modo livre).
- **Três capítulos, em sequência.** **Terra** (10 fontes: a eólica segue o vento, a solar
  o dia, a maremotriz a maré; gás e fusão têm custo de operação; nuclear, fusão e
  antimatéria esquentam), **Sistema Solar** (Enxame Orbital nas janelas de lançamento,
  Hélio-3 no dia lunar, Mercúrio, asteroides em cargas, Kugelblitz que precisa ser
  alimentado, Júpiter e Star Lifting) e **Galáxia** (Energia do Vácuo, Motor de Penrose,
  pulsares, Esferas de Dyson, quasares e a Energia Escura, que cresce com a partida).
- **Regiões.** A rede é a concessão da região atendida: Bairro, Cidade, Metrópole, Estado,
  País, Continente e Planeta na Terra (depois Lua, Marte… até o Sol, e a galáxia). Quando
  a produção chega ao que a próxima pede, `N` na aba Rede compra a concessão: mais rede e
  um kWh mais caro.
- **Pesquisa destrava o resto.** Laboratórios geram Pontos de Pesquisa (PP) para a árvore
  do capítulo (as pesquisas gerais, como laboratório, automação e rede, valem em todos):
  novas fontes, multiplicadores, capacidade, armazenamento e auto-compra.
- **A rede é o gargalo.** Acima da capacidade da região, o excedente vale só 25% do
  preço (mais com as pesquisas de armazenamento). A aba Rede mostra a rede em cinco
  visões (mapa, fluxo, gráfico, calor e previsão do tempo e do preço).
- **Upgrades e marcos.** Cada fonte tem 5 upgrades e dobra a produção ao chegar a 25, 50
  e 100 unidades. Compras em lote x1, x10, x100 ou MAX.
- **Eventos e crises.** Tempestades, picos de demanda e descobertas mudam o jogo por um
  tempo. Crises (blecaute, onda de calor, sobrecarga, ruptura de contenção e tempestade
  solar) ficam ativas até alguém agir: o manual de crise explica o minijogo de cada uma. Resolver sai de graça e dá um bônus;
  falhar, chamar a equipe ou ignorar custa o menor entre uma fração do caixa e alguns
  segundos de renda. As crises têm nível (0 a 10) que sobe a cada ascensão: começam
  fáceis e baratas e terminam pedindo atenção (até 25% do caixa ou 5 min de renda).
- **Legado.** A ascensão fecha uma partida completa: pede um mínimo ganho nela **e**
  atender uma região (na Terra, o País nas três primeiras e o Planeta depois), ou a
  árvore do capítulo completa. Quanto mais a partida rende, mais pontos ela dá (raiz
  cúbica do total ganho). Ao ascender, a partida recomeça e você recebe pontos (+10% de
  produção cada ponto guardado) que podem ser trocados por vantagens permanentes na loja
  do legado: começar com usinas, pesquisas, laboratórios, resfriamento, transformadores,
  baterias e a equipe de manutenção, construir mais barato, marcos antecipados, seguro
  contra crises, mais tempo offline e uma manivela que rende mais (e gira sozinha).
  Quando a loja acaba, o **Monumento** (x1.1 de produção por nível, sem teto) dá destino
  aos pontos que sobram.
- **Colonização.** Com a última região do capítulo atendida e legado suficiente, a visão
  **Império** da aba Legado (`I`) coloniza o próximo capítulo: o legado recomeça, você
  ganha **Patentes** (para uma árvore que vale em todos os capítulos) e o capítulo
  deixado vira colônia, com x1.5 na produção e Patentes por hora.
- **Visita à Terra.** Depois de colonizar, `T` na aba Legado ascende e leva a próxima
  partida de volta à Terra, com o legado de onde você está. Concluir a Terra de novo vale
  +50% dos pontos daquela ascensão e traz você de volta ao capítulo.
- **Mercado** (aba `K`). O preço do kWh oscila, a demanda passeia e às vezes vem um
  **surto** (kWh x1.6 por alguns segundos); vender muito de uma vez derruba o preço. Bancos
  de **baterias** guardam o excedente da rede para vender na hora boa (à mão ou no
  automático). **Contratos de fornecimento** (entregar, faturar, manter a produção verde,
  não deixar reator desligar) pagam minutos de renda ou de pesquisa, e a **reputação** da
  companhia sobe com eles e com as usinas em dia: contratos maiores e kWh mais caro.
- **Manutenção.** As usinas se desgastam (até 30% de perda) e de vez em quando uma unidade
  quebra. Na aba Rede, visão Manutenção: pagar a revisão, fazer à mão (um minijogo de
  setas, grátis) ou contratar a equipe, que cuida de tudo por 5% da receita. A visão
  Previsão mostra o tempo e o preço das próximas 24 h de jogo.
- **Modo disfarce.** Apareceu alguém? `\` (barra invertida) troca a tela inteira, de
  qualquer lugar do jogo, por algo que parece trabalho: testes rodando em modo watch, o
  log de um servidor ou um terminal vazio que aceita digitação. O jogo salva na hora,
  continua produzindo e pausa eventos e crises; `\` de novo volta e mostra quanto rendeu.
- **Desafios.** Seis partidas com regras que mudam o jogo (crises sem parar, sem vento,
  rede velha, mercado em queda, combustível caro, mercado volátil), cada uma com 5 níveis
  de meta, sempre na Terra. Ficam num slot separado (D), começam do zero sem legado e não
  tocam nos saves 1–3; o progresso e os recordes vão para um perfil compartilhado, e cada
  nível completo deixa os slots 1–3 mais fortes (x1.1 de produção e uma vantagem
  temática por nível).
- **Semente do dia.** Uma partida por dia igual para todo mundo (mesma seed, mesmas
  regras sorteadas): quem chega a $25B mais rápido? Ao terminar, o jogo mostra um código
  com o tempo para mandar aos amigos.
- **Conquistas.** 122 metas em onze categorias (algumas secretas), da primeira faísca a
  um quintilhão de dólares. Cada uma vale +1% de produção para sempre e sobrevive à
  ascensão; a lista com o progresso de cada uma fica na aba Estatísticas (`V`).
- **Progresso offline.** Ao voltar, o jogo credita até 1 h fora (mais com o legado) a 50%
  da produção e mostra um resumo.
- **Novidades e créditos.** No menu, Novidades mostra o histórico de versões (da 1.0 até a
  atual) e Créditos, quem fez o jogo e de onde ele veio.

## Fontes de energia

São 23 fontes, divididas pelos três capítulos. Cada uma é uma ideia real (ou teórica) de
gerar energia, com um comportamento próprio no jogo. Todas têm 5 upgrades, dobram a
produção com 25, 50 e 100 unidades e se desgastam com o tempo (até 30%, reparado na
visão Manutenção da aba Rede).

### Terra (de um bairro ao planeta inteiro)

| Fonte | O que é | No jogo |
|---|---|---|
| Turbina Eólica | O vento gira as pás de um gerador. | A primeira e mais barata; segue o vento (0,6x a 1,4x). |
| Painel Solar | Células fotovoltaicas convertem luz em eletricidade. | Rende de dia e quase nada à noite; baterias sobem o piso noturno. |
| Hidrelétrica | Água represada passando por turbinas. | Estável, com o reservatório oscilando entre estações (0,9x a 1,2x). |
| Usina de Biomassa | Queima de bagaço, cavaco e resíduos orgânicos. | Constante, sem surpresas. |
| Termelétrica a Gás | Gás natural queimado numa turbina. | Forte, mas com custo de operação (combustível). |
| Geotérmica | Vapor do calor interno da Terra. | Constante e sem custo de operação. |
| Reator Nuclear | Fissão de urânio aquecendo água. | Grande salto, mas esquenta: acima de 80% perde eficiência, em 100% desliga. |
| Maremotriz | Turbinas movidas pela maré. | Sobe e desce com a maré (±50%) num ciclo de 12,4 h de jogo. |
| Reator de Fusão | Núcleos leves se unindo, como no Sol. | Muito forte, com custo de operação e calor. |
| Antimatéria | Matéria e antimatéria se aniquilando. | A mais forte da Terra; superaquece mesmo sem upgrades. |

### Sistema Solar (do Tipo I ao Tipo II)

| Fonte | O que é | No jogo |
|---|---|---|
| Enxame Orbital | Espelhos e coletores em órbita, sem noite. | Produção fixa, mas só se compra na janela de lançamento. |
| Hélio-3 Lunar | Hélio-3 minerado na Lua para fusão limpa. | Só minera no dia lunar (um mês de 708 h de jogo); à noite cai a 10%. |
| Usina em Mercúrio | Coletores no planeta mais perto do Sol. | Luz intensa, mas esquenta como um reator. |
| Mina de Asteroides | Rebocadores trazendo minério do cinturão. | Rende em cargas: x3 nos últimos 6 s de cada 30 s. |
| Kugelblitz | Buraco negro artificial que emite radiação Hawking. | Precisa ser alimentado pelas outras fontes; crescer rápido demais o deixa com fome. |
| Dínamo de Júpiter | Corrente da magnetosfera de Júpiter. | Ciclo longo de ±40%. |
| Star Lifting | Puxar matéria da coroa do Sol com campos magnéticos. | A fonte final do capítulo, com calor no limite. |

### Galáxia (do Tipo II ao Tipo III)

| Fonte | O que é | No jogo |
|---|---|---|
| Energia do Vácuo | Energia de ponto zero das flutuações quânticas. | Instável, entre 0,2x e 5x; Volantes de Inércia seguram o piso em 1x. |
| Motor de Penrose | Energia tirada da rotação de um buraco negro. | A rotação gasta rápido: a manutenção é a recarga. |
| Fazenda de Pulsar | Antenas captando os feixes de estrelas de nêutrons. | Pulsos de x4 nos últimos 2 s de cada 12 s. |
| Esferas de Dyson | Cascas em volta de estrelas inteiras. | Como o Enxame, só se compram em janelas (maiores). |
| Coletor de Quasar | O disco e os jatos de um buraco negro supermassivo. | Produção enorme e calor alto. |
| Energia Escura | O que acelera a expansão do universo. | A fonte final: rende mais quanto mais longa a partida (até x5). |

### Para que serve cada tipo

- **Estáveis** (biomassa, geotérmica): base segura, sem pedir atenção.
- **Variáveis** (vento, sol, maré, dia lunar, Júpiter, Vácuo, pulsares, cargas): rendem bem
  na média e oscilam; valorizam a Previsão (aba Rede) e as baterias (aba Mercado).
- **Quentes** (nuclear, fusão, antimatéria, Mercúrio, Star Lifting, Quasar): os maiores
  saltos, com risco de desligar; pedem resfriamento.
- **Com custo de operação** (gás, fusão): lucram sempre, mas gastam combustível.
- **Com regra de compra** (Enxame, Dyson): pedem atenção ao momento de comprar.
- **Que dependem das outras** (Kugelblitz): obrigam a crescer de forma equilibrada.
- **Que premiam o tempo** (Energia Escura): mudam o fim de jogo para partidas longas.

## Requisitos

Nenhuma dependência: só módulos nativos do Node. Precisa de **Node.js 18+** ou
**[Bun](https://bun.sh)**, num terminal interativo de pelo menos **80×24**. Funciona em
Linux, macOS e Windows Terminal/WSL.

## Rodando

```sh
npm start              # ou: bun index.js
npm test               # ou: bun test
npm run simulate       # ou: bun scripts/simulate.js 90 --seeds=5 (--career joga os capítulos)
```

`scripts/simulate.js` joga sozinho usando só a lógica do jogo e imprime quando chegou a
cada marco (primeira solar, nuclear, fusão, cada ascensão), as crises (o bot erra mais
nas de nível alto, como um humano), quanto tempo a rede
passou saturada, quando a loja do legado ficou completa e o nível do Monumento. Com
`--challenge=<id> --tier=N` (ou `--daily=AAAA-MM-DD`), joga um desafio e mostra o tempo
até a meta. Opções: `[minutos] --seeds=N --runs=N --crises=play|idle|off --play=active|idle`
(`active` usa mercado, contratos e manutenção à mão; `idle` só contrata a equipe).

## Controles

| Onde | Teclas |
|---|---|
| Em qualquer tela | `\` disfarça o jogo (e volta) |
| Em qualquer aba | `G` `P` `R` `K` `L` `E` `O` (ou `Tab`/`Shift+Tab`) trocam de aba (`K` é o Mercado) · `espaço` gira a manivela · `X` abre o manual de crise · `M`/`Esc` menu (salva) · `Q` sai (salva) |
| Geradores | `↑↓` + `Enter` ou `0`–`9` compram · `←→` troca de página (10 fontes por página) · `B` lote · `U` upgrade · `A` auto-compra · `V` cena das usinas |
| Pesquisa | `↑↓` `PgUp` `PgDn` + `Enter` pesquisa |
| Desafios | `↑↓` desafio · `←→` nível · `Enter` joga · `C` continua a partida do slot D |
| Rede | `V` muda a visão · `N` expande a região · `T` transformador · `↑↓` + `C` resfriamento · na Manutenção: `↑↓` fonte, `F` paga, `J` à mão, `A` equipe |
| Mercado | `B` banco de baterias · `V` vende a carga · `A` venda automática · `C` carga barata · `1`–`3` aceita contrato · `D` desiste |
| Legado | `↑↓` + `Enter` ascende ou compra na loja (com confirmação `S`/`N`) · `T` ascende e visita a Terra (depois de colonizar) · `I` Império: `C` coloniza, `↑↓` + `Enter` compra Patentes |
| Estatísticas | `↑↓` `PgUp` `PgDn` `Home` `End` · `V` conquistas |
| Opções | `↑↓` escolhe, `←→`/`Enter` muda |

## Versão e atualizações

A versão aparece na tela de título. Uma vez por dia, em segundo plano, o jogo consulta as
tags do repositório no GitHub e avisa quando há versão nova. Sem internet nada trava: o
aviso só não aparece. Se a pasta do jogo for um clone git limpo na `main`, o item
**Atualizar** do título roda `git pull --ff-only` (os saves ficam em `~/.elden-grid/` e
não são tocados); senão, é só rodar `git pull` ou baixar a versão nova em
[Releases](https://github.com/localhost-ayu/elden-grid/releases). Para não consultar a
rede: Opções → Checar atualizações, ou `ELDEN_GRID_NO_UPDATE_CHECK=1`.

## Saves e opções

Tudo fica em `~/.elden-grid/`, fora do repositório (saves da época em que o jogo se
chamava Reactor ASCII, em `~/.reactor-ascii/`, são movidos para lá na primeira execução):

- `slot1.json` … `slot3.json` (e `.bak`): três saves. A gravação é atômica (`.tmp` +
  `rename`) e um save corrompido é recuperado do backup sem derrubar o jogo. Saves de
  versões antigas são migrados degrau por degrau (`saveVersion`).
- `slotD.json`: a partida de desafio em andamento.
- `profile.json`: perfil compartilhado entre os slots (níveis de desafio e recordes).
  Capítulo, região, Patentes e colônias ficam no próprio save de cada slot.
- `settings.json`: animações (ligadas, reduzidas, desligadas), 5/10/15 fps, símbolos
  Unicode ou ASCII puro, cores 256/16/sem cor, números curtos ou científicos, intervalo
  do autosave, tipo de disfarce e checagem de atualizações (com a última versão vista).
  A variável de ambiente `NO_COLOR` desliga as cores.
- `export-slotN.txt` / `import.txt`: o save em uma linha de texto (Base64), para levar
  para outra máquina. A exportação também tenta copiar o texto para a área de
  transferência do terminal (OSC 52).

## Arquitetura

```
index.js            liga terminal, storage e app; loop de quadros e autosave
src/data/           só números e textos de balanceamento (fontes, pesquisa, eventos…)
src/core/           regras do jogo, puras e determinísticas (sem terminal, sem disco)
src/storage/        saves em slots, escrita atômica, migração, opções, exportação, versão
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

## Versões

O histórico de mudanças de cada versão está no [`CHANGELOG.md`](CHANGELOG.md), e cada
versão lançada tem uma tag `vX.Y.Z` no git.

## Licença

Código disponível (*source-available*) sob a
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) — veja
[`LICENSE`](LICENSE). Não é open source no sentido da OSI, porque o uso comercial fica de fora.

- **Pode:** estudar, rodar, modificar, publicar e redistribuir, com ou sem mudanças, para
  qualquer fim não comercial: uso pessoal, estudo, pesquisa, ensino, hobby.
- **Precisa:** manter as linhas `Required Notice` do `LICENSE` em qualquer cópia ou trabalho
  derivado, com os créditos ao autor como **Nathã Grazzioli** ou **localhost-ayu**.
- **Uso comercial:** não é coberto pela licença. Para pedir uma licença comercial, use
  [este formulário](https://docs.google.com/forms/d/e/1FAIpQLSdDZxbuVtGmUTse3OaSYWKVuH1QsPGMNQyQyKvCVgf5GCXvug/viewform?usp=dialog).
