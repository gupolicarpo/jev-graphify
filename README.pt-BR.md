# Jev + Graphify — 0.5.2

Memória persistente por projeto para ajudar o agente a encontrar regras, escolher procedimentos e retomar uma tarefa depois de um teste falhar. Pacote comunitário independente; não é um produto oficial de OpenAI, Anthropic, Graphify ou TypeSafe.

O Graphify gera um grafo real do código local. O plugin guarda esse grafo junto das referências em `.jev-graphify/index.json`. Documentos Markdown/texto entram numa busca textual, que aceita variações da mesma palavra (por exemplo, "arredondar" encontra "arredondamento"); **esta versão não faz extração semântica por LLM de documentos**. Com a chave do Jev no ambiente, o Jev escolhe a skill e a referência, e também acha a skill certa num catálogo de skills desligadas (veja "Skills sob demanda"). Sem a chave, a busca local funciona e o agente pode analisar as candidatas.

Nada é instalado globalmente, publicado ou ligado a um serviço pago pelo instalador abaixo.

## Começo rápido

Três passos: baixar, rodar um comando e configurar a chave.

```bash
git clone https://github.com/gupolicarpo/jev-graphify.git
node jev-graphify/src/cli.mjs setup --project /caminho/do/seu-projeto
```

O `setup` instala as dependências do Node, cria o ambiente Python do Graphify, grava `.jev-graphify.json` e `.mcp.json` no seu projeto (nunca sobrescreve o que já existe; num `.mcp.json` existente ele só acrescenta o servidor) e gera o índice do código. Depois, ponha a chave em `JEV_API_KEY` no ambiente do programa que abre o agente e abra o agente na pasta do projeto. O restante desta página é o mesmo caminho feito à mão, com as opções.

## Começar no Windows

Tenha Node.js e Python 3.13 instalados. O ambiente verificado usou Node 24.19.0 e Python 3.13.15. Extraia o ZIP, abra o PowerShell na pasta extraída e execute:

```powershell
npm ci --ignore-scripts
python -m venv .venv-graphify
.\.venv-graphify\Scripts\python.exe -m pip install -r requirements-graphify.lock
$env:JEV_GRAPHIFY_PYTHON = (Resolve-Path '.venv-graphify/Scripts/python.exe').Path
npm test
npm run test:graphify
npm run demo
```

A instalação baixa bibliotecas públicas de npm/PyPI; não chama Jev nem LLM. O teste de Graphify exige a variável acima: sem ela, aparece como ignorado. A demonstração usa um teste Python real e um executor programado; Jev e revisão são simulados. O projeto fictício fica numa pasta temporária em `work/`, apagada ao terminar. O exemplo incluído não é alterado.

## Começar no macOS ou no Linux

Tenha Node.js 22 ou mais novo e Python 3.12 ou 3.13. Na pasta extraída:

```bash
npm ci --ignore-scripts
python3 -m venv .venv-graphify
./.venv-graphify/bin/python -m pip install -r requirements-graphify.lock
export JEV_GRAPHIFY_PYTHON="$PWD/.venv-graphify/bin/python"
npm test
npm run test:graphify
npm run demo
```

Sem `JEV_GRAPHIFY_PYTHON`, o plugin usa o ambiente `.venv-graphify` da própria pasta, se ele existir; senão chama `python` no Windows e `python3` nas outras plataformas. Para o Jev, deixe a chave em `JEV_API_KEY` no ambiente do programa que abre o agente (por exemplo, no perfil do seu shell), nunca em arquivos do projeto.

Verificado em Windows 11 e em Linux (Ubuntu 24.04, Node 22, Python 3.12): testes, Graphify real e demonstração. O repositório traz um teste automático (GitHub Actions) para Windows, macOS e Linux; até a primeira execução dele, **o macOS não foi verificado numa máquina de verdade**.

## Usar em seu projeto

Substitua os caminhos de exemplo pelos seus caminhos reais. Na pasta do plugin:

```powershell
node src/cli.mjs init --project "C:/CAMINHO/meu-projeto"
```

Abra o arquivo `.jev-graphify.json` criado **no seu projeto** e liste apenas os arquivos que deseja autorizar. São arquivos individuais, não pastas nem padrões:

```json
{
  "version": 1,
  "sources": ["src/invoice.py", "docs/regras.md"],
  "skills": ["skills/minha-skill/SKILL.md"]
}
```

Os caminhos usam `/` e ficam dentro do projeto. Não inclua segredos nem documentos pessoais. A lista é explícita: arquivos ocultos, `config`, `vault`, `secrets`, `credentials`, links simbólicos/junctions e arquivos de chave são recusados. A filtragem de nomes não detecta segredos escritos dentro de um arquivo comum; revise o conteúdo antes de autorizá-lo.

Gere a memória:

```powershell
node src/cli.mjs update --project "C:/CAMINHO/meu-projeto"
node src/cli.mjs status --project "C:/CAMINHO/meu-projeto"
```

Depois de editar uma fonte ou a lista, execute `update` novamente. A consulta recusa um índice desatualizado. Arquivos retirados da lista desaparecem na próxima atualização. Se apagou um arquivo, retire-o também da lista. Cada fonte tem hash SHA-256; mover/copiar um índice para outro projeto não o torna válido.

Para testar a busca no exemplo incluído:

```powershell
node src/cli.mjs update --project examples/project
node src/cli.mjs search --project examples/project --input examples/search.json
node src/cli.mjs route --project examples/project --input examples/route.json
```

Sem `JEV_API_KEY` no ambiente, `route` retorna `disabled` e mostra as candidatas. Isso não é uma escolha feita pelo Jev.

## Conectar Codex ou Claude Code

A forma mais previsível é configurar o MCP por projeto. MCP é a conexão que permite ao agente chamar as ferramentas do plugin. Não é necessário publicar o pacote.

**Codex:** use `examples/codex.config.toml` como exemplo e mescle a seção em `.codex/config.toml` do seu projeto. Troque os dois caminhos. Não substitua uma configuração existente inteira. `env_vars` permite repassar `JEV_GRAPHIFY_PYTHON`; mantenha a variável disponível no processo que abre o Codex. Reinicie a conexão MCP depois de mudar a configuração. A configuração e os manifestos foram conferidos; uma sessão real de agente Codex não foi executada nesta entrega.

**Claude Code:** mescle `examples/claude.mcp.json` em `.mcp.json` do projeto, substituindo os dois caminhos. O servidor herda `JEV_GRAPHIFY_PYTHON` do processo que abre Claude Code. No cliente, confira `/mcp`. Este host não estava instalado no ambiente de teste; a configuração segue a documentação oficial e ainda precisa de um teste de sessão real.

Em ambos os casos, coloque `skills/jev-graphify` em uma pasta de skills reconhecida pelo seu host, ou carregue o pacote pelo sistema de plugins do host. O pacote inclui `plugin.json`/`mcp.json` portáteis e os manifestos de compatibilidade `.codex-plugin`/`.claude-plugin`. No carregamento por plugin, o iniciador usa `JEV_GRAPHIFY_PROJECT` ou, no Claude, `CLAUDE_PROJECT_DIR`; sem nenhuma delas, usa a pasta onde o host iniciou o servidor (normalmente o projeto aberto). Se o host iniciar em outra pasta, use a configuração MCP por projeto acima. A expansão de variáveis e a instalação dos manifestos em cada host não foram verificadas numa sessão real.

A skill `karpathy-guidelines`, incluída a pedido, também pode ser usada separadamente para manter as mudanças simples.

Depois de conectar, peça: “Use a memória deste projeto para corrigir o arredondamento e confira os testes”. O agente decide quando chamar as ferramentas; não há interceptação universal de decisões nem troca automática do modelo principal.

## Jev: ligado quando há chave

O Jev é o seletor do plugin e é usado sempre que a variável `JEV_API_KEY` existe no ambiente do processo que inicia o servidor. O uso gera cobrança pelo provedor (TypeSafe). A chave é lida somente de `JEV_API_KEY`. Use o gerenciador de segredos ou ambiente local do seu sistema, sem colocá-la em arquivos do plugin, comandos, pedidos JSON ou logs.

Para desligar mesmo com a chave presente, acrescente `--no-jev` aos argumentos de inicialização do MCP/CLI; o iniciador de plugin `src/plugin.mjs` aceita a mesma opção. `--allow-paid-jev`, das versões 0.1.x, continua aceito e não faz mais nada. No Codex, acrescente `JEV_API_KEY` à lista `env_vars`. **Mudança em relação à 0.1.x: ter a chave no ambiente agora ativa as chamadas.** Os testes automáticos usam um Jev simulado; a busca de skill foi conferida uma vez com o serviço real (veja `docs/pt-BR/COMPATIBILIDADE.md`). `route` e `recover` não foram exercitados com o serviço real.

Uma chamada `route` pode fazer até duas requisições; uma recuperação, uma; uma busca de skill, duas (mais uma a cada 255 skills do catálogo). Quando o serviço responde 429 ou 529, há até duas novas tentativas, com espera curta. O prazo é de cinco segundos por requisição e a confiança mínima é 0,5; esse valor é apenas um limiar operacional, não uma garantia de acerto. Em falha de rede, baixa confiança ou escolha de nenhuma candidata, o resultado fica pendente para o agente.

O serviço recebe a tarefa e os títulos/descrições das candidatas. Descrições são extraídas do começo do texto ou do campo `description` da skill, portanto podem conter trechos do projeto. Na recuperação, a tarefa e a justificativa do diagnóstico são enviadas. Na busca de skill vão a tarefa, o nome e a descrição de cada skill do catálogo e, para as finalistas, a descrição completa e, só com `"privacy": "completo"`, os primeiros 700 caracteres do texto. O corpo completo das fontes e a chave não são incluídos no JSON enviado. Use apenas dados que você autoriza compartilhar com TypeSafe.

Antes de cada envio, trechos com cara de segredo (chaves `sk-…`, tokens do GitHub/AWS/Slack, JWT, blocos de chave privada e atribuições como `token=…` ou `senha: …`) são trocados por `[REDACTED]`. Essa limpeza reduz o risco, mas não detecta todo segredo. Cada requisição fica registrada em `.jev-graphify/sent.jsonl`, no projeto: data, finalidade, tamanho, quantidade de trechos limpos, resultado e tokens cobrados — nunca o conteúdo. Não há consulta de saldo nem limite monetário automático: o controle é a presença da chave, `--no-jev` e esse registro.

### Teto de gasto por dia

Como o Jev fica ligado sempre que há chave, cada projeto tem um teto diário de tokens de entrada enviados a ele: 250 milhões por padrão (perto de US$ 10,50 no preço publicado). Ao atingir o teto, as ferramentas passam a responder pela ordenação local até o dia virar (horário UTC) e o resultado traz `reason: "daily_limit"` com o usado e o limite. Mude com `--jev-daily-tokens <n>` nos argumentos de inicialização, ou com a variável `JEV_GRAPHIFY_DAILY_TOKENS` no carregamento por plugin; `0` tira o limite. A conferência é feita uma vez por chamada, antes da primeira requisição, então uma chamada grande pode passar um pouco do teto. A conta vem do registro `.jev-graphify/sent.jsonl`.

### Ferramentas ligadas

Cada ferramenta registrada ocupa contexto em toda sessão do agente. Por isso só cinco ficam ligadas por padrão: `memory_status`, `memory_update`, `memory_recall`, `project_find` e `skill_find` (cerca de 540 tokens por sessão). As quatro do fluxo antigo (`memory_search`, `memory_read`, `jev_route` e `memory_recover`) só aparecem com `--all-tools` nos argumentos de inicialização ou `JEV_GRAPHIFY_ALL_TOOLS=1` (cerca de 1.190 tokens com as nove).

## Lembrar com teto de tokens

A ferramenta `memory_recall` existe para o agente não reler tudo quando precisa se recontextualizar: no começo de uma sessão, depois de uma compactação de contexto ou antes de abrir arquivos. Ela lê as memórias e as fontes do projeto, o Jev avalia cada trecho contra a tarefa, e o agente recebe só os trechos que servem, dentro de um teto de tokens (padrão 1.500; de 200 a 8.000).

De onde vêm os trechos:

- **Memórias do Claude Code.** A pasta `~/.claude/projects/<projeto>/memory` do projeto fixado é encontrada sozinha. Para desligar, use `--no-auto-memory`.
- **Outras pastas de memória.** `--memory-dir "C:/CAMINHO"` (pode repetir) ou a variável `JEV_GRAPHIFY_MEMORY_DIRS`. São lidos os arquivos `.md` da pasta e de um nível de subpastas; o índice `MEMORY.md` é ignorado.
- **Fontes do projeto.** Os arquivos em `sources` no `.jev-graphify.json`, lidos na hora; não é preciso rodar `update`.

As memórias do Codex ficam num banco SQLite próprio e **não são lidas nesta versão**. As transcrições completas das sessões também não.

Como a escolha é feita: cada arquivo é cortado em trechos de até 2.000 caracteres (por título, em Markdown; por linhas, em código). Com o Jev, a consulta tem duas formas:

- **Acervo pequeno** (até uns 60 mil caracteres): cada trecho vira uma pergunta de sim ou não ("este trecho ajuda nesta tarefa?"), em lotes paralelos. O Jev lê tudo.
- **Acervo grande:** primeiro o Jev lê só a **ficha** de cada arquivo (nome, descrição e títulos das seções) e ficam os 12 arquivos mais bem colocados; depois ele lê o texto completo apenas desses. Num acervo real de 167 arquivos isso custou cerca de 57 mil tokens do Jev por consulta, contra 441 mil lendo tudo, com o mesmo acerto nas perguntas que a descrição da memória deixa entrever.
- **Leitura completa a pedido (`deep`):** a ficha não revela um detalhe que só existe no meio do texto. Em 5 perguntas desse tipo, a consulta por fichas achou a memória certa em 2 e a leitura completa em 5. Por isso o agente pode repetir a consulta com `deep: true`, que lê o acervo inteiro pelo preço do acervo inteiro.

O resultado diz qual forma foi usada (`strategy`: `full`, `cards` ou `local`) e, em `related`, lista só pelo título as memórias ligadas por `[[nome]]` às que foram devolvidas. Ficam os trechos com relevância de pelo menos 0,60, do mais relevante para o menos, até encher o teto. Os que ficam entre 0,30 e 0,60 vêm só como ponteiros em `near` (origem e título, sem texto), para o agente saber o que mais existe gastando quase nada. Sem chave, com `--no-jev` ou em falha do serviço, a ordenação é local, por palavras, e o resultado diz isso (`status` igual a `local` ou `unavailable`). Quando nenhum trecho alcança 0,60, o resultado é `none`. Os dois cortes foram ajustados num teste real pequeno, com 30 memórias fictícias, em que a memória certa pontuou de 0,73 a 0,98 e o ruído de 0,30 a 0,57; não foram calibrados com memórias reais.

**Privacidade.** O padrão é `ficha`: para a TypeSafe vai só a ficha de cada arquivo (nome, descrição curta e títulos das seções), nunca o texto. É menos preciso, e `deep` não tem efeito nesse modo. Para ligar o texto completo, acrescente `"privacy": "completo"` ao `.jev-graphify.json` do projeto; aí o texto de cada trecho vai para a TypeSafe a cada consulta, o que inclui as memórias, que podem conter dados pessoais seus. `--privacy` nos argumentos de inicialização (ou `JEV_GRAPHIFY_PRIVACY`) vale mais que o arquivo. Duas ressalvas do modo `ficha`: memória sem descrição no cabeçalho usa os primeiros 160 caracteres do texto como descrição, e o mesmo vale para arquivos do projeto, então um pouco do texto ainda sai. Com `--no-jev` nada é enviado. A limpeza de segredos e o registro de envios valem nos dois modos.

O resultado traz `corpus.tokens_estimate` (quanto custaria ler tudo) e `returned_tokens_estimate` (quanto foi devolvido). São estimativas por contagem de caracteres, 3,5 por token, não uma medição do modelo. Limites: 2.000 arquivos de memória ou 8 MiB, 6.000 trechos, até 20 trechos por resposta. Teste pelo CLI:

```powershell
node src/cli.mjs recall --project examples/project --input examples/recall.json
```

## Achar no código do projeto

A ferramenta `project_find` responde "em que arquivo está o código que faz isto?" sem o agente sair procurando e abrindo arquivos. São duas peças:

- **O Graphify organiza.** Ele analisa o código localmente, sem LLM e sem custo, e liga os arquivos pela estrutura real do programa (quem chama, quem herda, quem importa). Dessas ligações saem os **núcleos**: grupos de arquivos que trabalham juntos.
- **O Jev escolhe.** Para cada pergunta ele escolhe primeiro os módulos (as pastas de topo do código), depois os núcleos dentro deles e por fim ordena só os arquivos desses núcleos. Em projeto pequeno, as etapas de módulo e de núcleo são dispensadas. O agente recebe caminhos e nomes de símbolos, não o conteúdo.

Para ligar, acrescente ao `.jev-graphify.json` do projeto quais pastas são código:

```json
{
  "version": 1,
  "sources": [],
  "skills": [],
  "code": { "roots": ["."], "exclude": ["Backups", "_checkpoints"] }
}
```

`roots` são pastas dentro do projeto (`"."` é o projeto inteiro). `exclude` tira pastas ou caminhos, sem diferenciar maiúsculas. Ficam sempre de fora: pastas ocultas, `bin`, `obj`, `node_modules`, `packages`, pastas de segredos, links simbólicos e arquivos de chave. Só entram arquivos de código (as extensões estão em `src/graphify.mjs`). Limites: 6.000 arquivos, 96 MiB no total, 1 MiB por arquivo.

Depois gere o índice. Num projeto grande isso leva minutos, então prefira o CLI na primeira vez:

```powershell
node src/cli.mjs update --project "C:/CAMINHO/meu-projeto"
```

Os arquivos são copiados para uma área temporária dentro de `.jev-graphify`, o Graphify roda sobre a cópia e o resultado fica em `.jev-graphify/project.json`. Nada é escrito no restante do projeto. Depois de mudar o código, rode `update` de novo. A partir da segunda vez ele é parcial: só os arquivos alterados, novos ou removidos são reanalisados, o que leva segundos, e os núcleos são mantidos (arquivo novo herda o núcleo dos vizinhos de pasta). Quando as mudanças acumuladas passam de 15% dos arquivos, ou quando você pede com `update --full`, tudo é refeito. Enquanto o índice está atrasado, a busca continua funcionando e avisa com `stale: true` e, em `stale_files`, quais arquivos mudaram.

**Privacidade.** Para o Jev vão a pergunta, os caminhos dos arquivos e os nomes de classes e métodos. O texto do código não é enviado. Sem chave ou com `--no-jev`, a ordenação é local, por palavras, e funciona mal quando a pergunta está numa língua e o código em outra.

Num projeto real de cerca de 2.000 arquivos em C#, com 24 perguntas em português, o arquivo certo ficou entre os 3 primeiros em 22 e entre os 5 primeiros em 23, por cerca de 65 mil tokens do Jev por pergunta (menos de um terço de centavo de dólar) e com o índice pronto em menos de 3 minutos; os detalhes e os limites dessa medição estão em `docs/pt-BR/COMPATIBILIDADE.md`. Teste pelo CLI:

```powershell
node src/cli.mjs find --project "C:/CAMINHO/meu-projeto" --input examples/find.json
```

## Skills sob demanda

Skills ligadas no host custam tokens em toda conversa, porque a descrição de cada uma fica no contexto. Aqui a ideia é o contrário: você guarda as skills **desligadas** numa pasta sua, e a ferramenta `skill_find` entrega o texto da skill certa só quando uma tarefa precisa dela.

Monte o catálogo como uma pasta em que cada subpasta tem um `SKILL.md` (o formato comum de skills, com `name` e `description` no cabeçalho). Aponte o servidor para ela com `--skills-dir "C:/CAMINHO/minhas-skills"` nos argumentos de inicialização do MCP/CLI ou, no carregamento por plugin, com a variável `JEV_GRAPHIFY_SKILLS_DIR`. As skills listadas em `skills` no `.jev-graphify.json` do projeto entram no mesmo catálogo. O catálogo é lido a cada busca; não é preciso rodar `update`. Limite: 1.020 skills, 128 KiB por `SKILL.md`; links simbólicos são ignorados.

A escolha segue a receita publicada pela TypeSafe, em duas requisições: a primeira ordena o catálogo inteiro e avalia se a tarefa precisa mesmo de uma skill; a segunda confere as três melhores com mais texto e pergunta, para cada uma, se ela faz o que foi pedido. Resultados:

- `selected`: traz o texto da skill (até 20.000 caracteres), o caminho do arquivo, a confiança e até três alternativas.
- `none`: nenhuma skill serve (`reason` diz se a tarefa não pede skill ou se nenhuma finalista se encaixou). O agente segue sem skill.
- `disabled` (sem chave ou com `--no-jev`) e `unavailable` (falha do serviço): trazem até cinco candidatas da busca local, para o agente avaliar por conta própria.
- `empty_catalog`: não há skills configuradas.

Quando um `SKILL.md` do catálogo é grande demais, não está em UTF-8 ou é um link, ele fica fora da disputa e aparece em `skipped` no resultado.

Os limiares (0,30 e 0,50) são os da receita, definidos à mão pela TypeSafe; não foram calibrados com dados seus. Uma sugestão confiante e errada pode desviar o agente, por isso a skill do plugin manda ignorar a sugestão que não combina com o pedido. Teste pelo CLI:

```powershell
node src/cli.mjs skill --project "C:/CAMINHO/meu-projeto" --skills-dir "C:/CAMINHO/minhas-skills" --input examples/route.json
```

## Quando uma tarefa falha

O agente revisa o código e os testes. Se faltar uma regra do projeto, busca a referência e usa `memory_recover` com uma evidência literal da falha. O plugin valida o pedido e prepara contexto com origem/versão. O **mesmo agente executor** precisa aplicar a correção e executar os testes originais.

`ready_for_executor` significa “contexto pronto”, não “problema corrigido”. A skill limita o fluxo a duas rodadas e manda parar se a mesma falha repetir. Esse controle entre chamadas pertence ao agente cliente; o MCP é sem estado de sessão e não impede que um cliente incorreto reenvie a rodada 1. Ele não executa comandos, não retoma subsessões por conta própria e não aprova aprendizados automaticamente.

Para persistir um aprendizado, revise a evidência com o usuário, atualize o documento fonte autorizado e rode `update`. Memórias e skills recuperadas são dados não confiáveis; não podem conceder permissões nem autorizar gastos.

## Limites e problemas comuns

- Até 100 arquivos explícitos, 128 KiB por arquivo e 2 MiB no total. Até 12 skills na seleção Jev, 12 referências na pré-busca, seis na recuperação. Texto retornado por fonte limitado a 6.000 caracteres; `truncated` sinaliza cortes.
- Graphify limitado a 20 mil nós/80 mil relações; grafo bruto até 8 MiB. Código usa AST local, sem agrupamento de comunidades; PDF, vídeo, SQL e extração semântica não estão integrados nesta versão. Extensões aceitas estão em `src/graphify.mjs`.
- Atualização reconstitui o grafo a partir das fontes autorizadas. Se nada mudou, não roda Graphify. Se falhar, preserva o índice anterior e mantém as consultas bloqueadas até atualizar.
- `Graphify falhou`: a mensagem traz o final do erro real (por exemplo, Python não encontrado ou `graphifyy` ausente). Confira o executável em `JEV_GRAPHIFY_PYTHON` e a instalação de `graphifyy==0.9.107`. Outra versão é recusada para evitar mudanças de contrato silenciosas.
- `Atualização em andamento`: espere a outra atualização. Se um processo caiu no meio, a trava `.jev-graphify/update.lock` é assumida sozinha: na hora, quando o processo que a criou nesta máquina já terminou, ou depois de 3 minutos. Não remova uma trava enquanto houver atualização ativa.
- Índice copiado/corrompido: com o servidor parado, remova apenas `.jev-graphify/index.json` do projeto correto e execute `update`. O índice é reconstruível a partir das fontes; não apague as fontes.
- O processo MCP herda as permissões de quem o iniciou. Ele não é um isolamento de sistema operacional e não recebe automaticamente todas as regras internas de permissão do host. Autorize o diretório explicitamente e use as permissões/sandbox do host. Não execute em pastas controladas por terceiros que possam trocar arquivos/links durante a leitura.
- Inclua `.jev-graphify/` no `.gitignore` do projeto: ali há cópias das fontes autorizadas. Não envie essa pasta à comunidade. O pacote distribuído não inclui índices, ambientes, históricos ou chaves.

Consulte `docs/pt-BR/COMPATIBILIDADE.md` para o que foi testado, `docs/pt-BR/API.md` para integrar o núcleo e `THIRD_PARTY_NOTICES.md` para origem e licenças.
