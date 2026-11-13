# Origem, dependências e licenças

O núcleo deste pacote foi escrito de forma independente, após leitura dos módulos indicados no escopo. Não inclui código, configuração, histórico ou memória do Harness nem do cache de plugins. Código novo do pacote: MIT, em `LICENSE`. A skill karpathy-guidelines foi fornecida pelo solicitante com licença MIT e crédito às observações de Andrej Karpathy.

Graphify é um projeto separado de Graphify-Labs. Origem verificada em [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify), com correspondência de nome/versão/repositório no [PyPI graphifyy 0.9.107](https://pypi.org/project/graphifyy/0.9.107/). A distribuição declara Apache-2.0 e preserva partes MIT anteriores. Copiamos, sem alteração, `LICENSE`, `LICENSE-MIT` e `NOTICE` da distribuição instalada para `docs/third-party/graphify/`. Não incluímos o código do Graphify ou suas dependências no ZIP. São instalados separadamente pelo usuário.

Integridade publicada no PyPI para a versão usada:

- wheel `graphifyy-0.9.107-py3-none-any.whl`: SHA-256 `daf286a0b4d2ac137e6c27637d2d86f754a0c7487faa925cda409e8b631741cf`.
- fonte `graphifyy-0.9.107.tar.gz`: SHA-256 `3c0448ecd8a048a2b6bfa2d6ff72610ce290696f699f286522086ce7ba02ce9a`.

O adaptador chama a versão instalada em modo AST local, sem extras de provedores. `requirements-graphify.lock` registra as 31 versões verificadas em CPython 3.13/Windows; não é um pacote de bibliotecas embutidas nem garante instalação em qualquer plataforma. Licenças e URLs declaradas das dependências transitivas estão em `docs/dependencies-python.json`. A instalação de cada distribuição preserva seus próprios arquivos de licença; eles continuam aplicáveis.

MCP usa os pacotes oficiais `@modelcontextprotocol/server`, `client` (testes) e `core`, versão 2.4.0, Apache-2.0, do [SDK TypeScript MCP](https://github.com/modelcontextprotocol/typescript-sdk). Zod 4.6.7 é MIT, do [projeto Zod](https://github.com/colinhacks/zod). As licenças dos pacotes diretos e do core foram preservadas em `docs/third-party/`. `package-lock.json` inclui versões, URLs e integridade npm; `docs/dependencies-npm.json` lista também as dependências de desenvolvimento. `node_modules` não é redistribuído.

Jev é um serviço proprietário externo de TypeSafe. Não copiamos seu SDK nem componentes do serviço; usamos HTTP com fetch nativo, conforme a [especificação pública da API](https://api.typesafe.ai/openapi.json). Uma licença MIT do plugin não concede créditos, acesso nem direitos sobre Jev, Graphify ou os clientes anfitriões. Não há afiliação oficial.

Documentação consultada em 12/11/2026:

- [OpenAI: empacotar plugins](https://developers.openai.com/plugins/build/plugins).
- [OpenAI: configuração MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
- [Claude Code: referência de plugins](https://code.claude.com/docs/en/plugins-reference).
- [Agent Plugins: schema de plugin](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) e [schema MCP](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json).
- [MCP: servidor](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server) e [cliente](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect).

As instruções de instalação são adaptações para este pacote; schemas válidos não provam carregamento nem execução em todos os hosts.
