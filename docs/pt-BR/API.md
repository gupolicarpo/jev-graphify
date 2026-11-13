# Núcleo e ferramentas

O código reutilizável é `src/core.mjs`. Recebe o caminho fixado do projeto em cada operação. `init(root)`, `status(root)`, `update(root)`, `search(root, query, kind)`, `read(root, id)`, `route(root, task, options)` e `recover(root, input, options)` são funções assíncronas. Não importam código do Harness.

`update` aceita `{ python }`, definido pelo integrador confiável, não por uma ferramenta MCP. `route`/`recover` aceitam `{ jev, key, request, signal }`. `request` é uma função compatível com fetch para testes ou integração; os adaptadores distribuídos não expõem troca de endpoint/transporte ao modelo. O Jev é usado quando `key` existe e `jev` não é `false`. O núcleo não lê a chave do ambiente: só os pontos de entrada (`src/cli.mjs`, `src/plugin.mjs`) leem `JEV_API_KEY` e a repassam, então chamar o núcleo sem opções nunca acessa a rede.

`src/jev.mjs` tem o cliente: `ask({ state, questions, key, request, signal, timeoutMs, retries, onSend })` envia perguntas `choice`/`noul`, limpa trechos com cara de segredo (`scrub`), tenta de novo em 429/529 e limita a resposta a 256 KiB; `choose` monta sobre ele a seleção usada por `route`/`recover`. `src/skills.mjs` tem `loadCatalog(root, { skillsDir })` e `findSkill(root, task, options)`, a busca de skill em duas requisições. Toda requisição é registrada, sem conteúdo, por `appendSendLog` em `.jev-graphify/sent.jsonl`. Cancelamento é propagado por `choose`; os adaptadores atuais não conectam o cancelamento MCP à extração local. Graphify tem prazo de 60 segundos.

O MCP fixa o projeto na inicialização, sem parâmetro para trocar projeto, executar shell ou informar chaves. Ferramentas:

| Ferramenta | Entrada principal | Efeito |
|---|---|---|
| memory_status | nenhuma | Lê validade e contagens |
| memory_update | nenhuma | Escreve índice local, chama somente extração AST |
| memory_search | query, kind=reference ou skill | Busca textual + até dois saltos no grafo |
| memory_read | id | Lê até 6.000 caracteres de uma fonte indexada |
| jev_route | task | Seleciona skill e referência; usa a rede quando há chave e `--no-jev` não foi passado |
| memory_recover | task, failure, diagnosis, loadedIds, round | Prepara contexto de recuperação |
| skill_find | task | Acha a skill certa no catálogo de skills desligadas e devolve o texto dela |
| memory_recall | query, budget (200–8000, padrão 1500), deep (padrão falso) | Devolve só os trechos de memória e do projeto que servem à tarefa, dentro do teto de tokens |
| project_find | query, top (1–20, padrão 5) | Diz em que arquivos do projeto está o código que serve à tarefa; devolve caminhos e símbolos |

`skill_find`, `memory_recall`, `project_find`, `jev_route` e `memory_recover` gravam o registro de envios, por isso não são anunciadas como somente leitura.

Só `memory_status`, `memory_update`, `memory_recall`, `project_find` e `skill_find` são registradas por padrão; `memory_search`, `memory_read`, `jev_route` e `memory_recover` exigem `allTools` (`--all-tools` ou `JEV_GRAPHIFY_ALL_TOOLS=1`).

Privacidade: `privacyOf(root, options)` em `src/files.mjs` resolve o modo, nesta ordem: opção `privacy` explícita, chave `privacy` do `.jev-graphify.json`, e por fim `ficha`. `recall` e `findSkill` usam essa função; em `ficha`, `recall` só faz a etapa de fichas e `findSkill` não envia o trecho do texto das finalistas.

Teto diário: `jevGate(root, options)` em `src/files.mjs` decide, uma vez por chamada, se o Jev pode ser usado. Devolve `jev: false` com `reason` igual a `turned_off`, `no_key` ou `daily_limit`; neste último caso soma os `input_tokens` do dia (UTC) em `sent.jsonl` (`usedToday`) e compara com `options.dailyTokens` (padrão 250 milhões; 0 desliga o teto). Quando o registro é truncado por tamanho, uma linha `carry` preserva o total do dia.

`src/project.mjs` cuida do código do projeto. Em índice com mais de 60 núcleos e pelo menos 8 módulos (pastas de topo), `findInProject` faz antes uma etapa por módulo (finalidade `project_modulos`, opção `modulos`, padrão 5) e só pergunta pelos núcleos que têm arquivo nos módulos escolhidos; a estratégia aparece como `modulos` no resultado. `walkCode(root, code)` lista os arquivos de código das pastas em `code.roots`, com as exclusões; `buildProject(root, code, { python })` copia esses arquivos para uma área temporária em `.jev-graphify`, roda `src/graphify-project.py` (Graphify `extract --code-only`, com agrupamento em comunidades) e devolve o índice: por arquivo, o núcleo e até 40 símbolos; por núcleo, rótulos, pastas e arquivos. `update` grava esse índice em `.jev-graphify/project.json` quando `code` está configurado. `findInProject(root, query, { top, nucleos })` faz a busca: com Jev e índice grande, uma pergunta `noul` por núcleo (finalidade `project_nucleos`), ficam os `nucleos` melhores (padrão 8) e depois uma pergunta por arquivo deles (`project_files`); com índice pequeno (até 12 núcleos ou 60 arquivos), uma etapa só; sem Jev, ordenação local por palavras. Índice desatualizado não bloqueia a busca: o resultado traz `stale: true` e `stale_files` (até 10 caminhos alterados, novos ou removidos). O índice guarda um carimbo (tamanho e data) por arquivo; `refreshProject(root, code, index)` reanalisa só os arquivos cujo carimbo mudou, mantém os núcleos e soma as mudanças em `drift`; devolve `null` (e `update` refaz tudo com `buildProject`) quando o índice é antigo e não tem carimbos, quando `drift` passa de `PARTIAL_MAX` (15% dos arquivos, mínimo 20) ou quando o Graphify falha na parte. `update` informa `mode` (`incremental` ou `full`) e `changed`; `update(root, { full: true })` e `--full` no CLI forçam a reconstrução.

`src/memory.mjs` tem `loadMemory(root, { memoryDirs, autoMemory, home })` (pastas de memória em Markdown, inclusive a do Claude Code para o projeto), `loadProject(root)` (as fontes do projeto, lidas na hora), `chunk(text, opções)` (corte em trechos) e `recall(root, query, opções)`. `recall` não depende do índice nem do Graphify: lê os arquivos a cada chamada. Com Jev as perguntas são `noul`, em lotes de até 300 perguntas ou 150 mil caracteres, seis lotes por vez. Estratégias (`strategy` no resultado): `full`, uma pergunta por trecho no acervo inteiro, usada quando o texto soma até `FULL_SCAN_CHARS` (60 mil caracteres) ou quando `deep` é verdadeiro; `cards`, uma pergunta por arquivo com a ficha (finalidade `recall_cards` no registro de envios) e depois uma por trecho só dos `topFiles` arquivos mais bem colocados (padrão 12, de 1 a 50; opção do núcleo, não exposta no MCP); `local`, sem Jev. No modo `ficha` só existe a etapa de fichas. Se algum lote falhar, vale a ordenação local. `related` traz as memórias citadas por `[[nome]]` nos trechos devolvidos.

`diagnosis` tem `kind` (`memory_gap`, `code_issue`, `inconclusive`), `reason`, `evidence` literal da falha e `queries` (até três). A ferramenta não gera o diagnóstico por LLM: isso cabe ao revisor do agente cliente. `examples/recover.json` é um pedido fictício executável via CLI. Exemplo:

```powershell
node src/cli.mjs recover --project examples/project --input examples/recover.json
```

Sem chave ou com `--no-jev`, `memory_gap` fica `memory_pending`, com candidatas que o cliente pode ler e avaliar. `code_issue` não chama Jev e permite correção com o contexto já carregado. `inconclusive` fica `review_pending`. `context_limit` sinaliza mais de 12 mil caracteres nas memórias; o integrador precisa reduzir o contexto.

O CLI usa as mesmas funções. A opção `--project` é obrigatória; `--input` é um arquivo JSON de até 32 KiB. Não aceita chaves nem comandos em argumentos. Pedidos MCP usam validação estrita com Zod. Saída padrão do MCP contém apenas o protocolo; erros do Graphify são resumidos para não copiar ambiente ou saídas privadas.

Geração real: arquivos de código aprovados são copiados para uma área temporária dentro de `.jev-graphify`, sem executar esse código. `graphify-bridge.py` verifica a versão instalada e chama `graphify.cli.dispatch_command('extract')` com `--code-only --no-cluster --max-workers 1 --no-dedup`. Evita o inicializador de instalação/skills de `python -m graphify`. O ambiente filho não recebe chaves/API/configuração do usuário. O `graph.json` bruto é validado e normalizado para nós/relações com fontes autorizadas, junto de snapshots das fontes. A área temporária é removida. Não há publicação de grafo global.

Os snapshots são gravados numa troca atômica de arquivo e protegidos por trava de atualização. A revisão inclui a lista de fontes, os hashes e seus tipos. Leitura confere revisão e projeto. Esta proteção não torna um índice local resistente a um usuário que já pode editar seus arquivos; origem/hash ajudam rastrear alterações, não são assinatura criptográfica de confiança.
