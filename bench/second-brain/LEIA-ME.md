# Segundo Cérebro + código: conjunto de medição

## O que é
Um conjunto **fictício** para medir se o `memory_recall` e o `project_find` entregam, numa só pergunta, a nota certa de um Second Brain (vault estilo Obsidian) e os arquivos de código ligados a ela.

- `faturamento/`: um SaaS de faturamento em Python inventado (36 módulos com código, mais `__init__`), pacotes `billing`, `taxes`, `payments`, `customers`, `reports`, `notifications`, `auth`, `integrations/erp`, `jobs`, `api`. Não roda de verdade e não tem segredo real.
- `vault/`: 218 notas em português sobre o time que faz esse sistema, misturadas com ruído pessoal (leituras, diário, inbox). Tem decisões substituídas, reuniões que discutem decisões, incidentes e runbooks, `Templates` (para excluir por configuração), `.obsidian` (deve ser ignorada) e 3 notas privadas com o marcador `MARCADOR-PRIVADO-7731`.
- `casos.json`: 40 perguntas (`pedido`, `esperado`, `codigo`, `tipo`). Tipos: paráfrase 14, direto 6, substituída 6, código via nota 6, nenhuma 6, pessoal 2.
- `rodar-segundo-cerebro.mjs`: o executor. `verificar-conjunto.mjs`: confere que casos, caminhos, símbolos e links apontam para coisas que existem.

## Como foi feito
Escrito por um agente de IA a partir de um plano de assuntos: primeiro o código, depois as notas citando símbolos reais, depois as perguntas. Nada vem de dados de verdade.

## Como rodar
```
node bench/second-brain/verificar-conjunto.mjs        # consistência do conjunto
node bench/second-brain/rodar-segundo-cerebro.mjs preparar
node bench/second-brain/rodar-segundo-cerebro.mjs local
JEV_API_KEY=... node bench/second-brain/rodar-segundo-cerebro.mjs jev-ficha
JEV_API_KEY=... node bench/second-brain/rodar-segundo-cerebro.mjs jev-completo
node bench/second-brain/rodar-segundo-cerebro.mjs base-local
JEV_API_KEY=... node bench/second-brain/rodar-segundo-cerebro.mjs base-jev
```
- `preparar` copia `faturamento` para `projeto/`, acrescenta `brain.exclude: ["Templates"]` e roda `update` (Graphify via `JEV_GRAPHIFY_PYTHON`).
- `jev-*` e `base-jev` **enviam conteúdo do vault ao Jev**; o executor avisa antes. A chave só é lida de `JEV_API_KEY` e nunca é impressa nem gravada.
- `base-*` é a linha de base sem o recurso: o vault vira uma pasta plana de memórias (sem Templates, `.obsidian` nem notas privadas) e só entra em `memoryDirs`.
- Resultado em `resultado-<modo>.json` (resumo + linhas), com pedidos, caminhos de nota e números; nunca o texto das notas. `vazamentos` deve ser 0.
- `TESTE_MAX=n` limita a quantidade de casos.

## Ressalvas
- Dados sintéticos escritos pelo mesmo autor das perguntas: há viés otimista (o vocabulário das notas e o das perguntas combinam mais do que num vault real).
- Conjunto pequeno (40 casos): diferenças de poucos casos não são significativas.
- Notas de inbox, leituras e diário são mais curtas que as demais (9 a 51 palavras no diário); o "ruído" é mais leve do que num vault de anos de uso.
- Sem chave, o recall local sempre preenche o teto de tokens com o que tem; por isso "nenhuma" não acerta localmente e "na resposta" fica inflado. O número que importa nesse modo é o primeiro lugar.
