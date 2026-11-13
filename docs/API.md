# Core and tools

The reusable code is `src/core.mjs`. It receives the pinned project path in each operation. `init(root)`, `status(root)`, `update(root)`, `search(root, query, kind)`, `read(root, id)`, `route(root, task, options)` and `recover(root, input, options)` are asynchronous functions. They do not import Harness code.

`update` accepts `{ python }`, set by the trusted integrator, not by an MCP tool. `route`/`recover` accept `{ jev, key, request, signal }`. `request` is a fetch-compatible function for tests or integration; the distributed adapters do not expose endpoint/transport switching to the model. Jev is used when `key` exists and `jev` is not `false`. The core does not read the key from the environment: only the entry points (`src/cli.mjs`, `src/plugin.mjs`) read `JEV_API_KEY` and pass it on, so calling the core without options never touches the network.

`src/jev.mjs` holds the client: `ask({ state, questions, key, request, signal, timeoutMs, retries, onSend })` sends `choice`/`noul` questions, cleans snippets that look like secrets (`scrub`), retries on 429/529 and limits the response to 256 KiB; `choose` builds on it the selection used by `route`/`recover`. `src/skills.mjs` has `loadCatalog(root, { skillsDir })` and `findSkill(root, task, options)`, the two-request skill search. Every request is recorded, without content, by `appendSendLog` in `.jev-graphify/sent.jsonl`. Cancellation is propagated by `choose`; the current adapters do not connect MCP cancellation to local extraction. Graphify has a 60-second deadline.

The MCP pins the project at startup, with no parameter to change project, run a shell or supply keys. Tools:

| Tool | Main input | Effect |
|---|---|---|
| memory_status | none | Reads validity and counts |
| memory_update | none | Writes local index, calls AST extraction only |
| memory_search | query, kind=reference or skill | Text search + up to two hops in the graph |
| memory_read | id | Reads up to 6,000 characters of an indexed source |
| jev_route | task | Selects skill and reference; uses the network when there is a key and `--no-jev` was not passed |
| memory_recover | task, failure, diagnosis, loadedIds, round | Prepares recovery context |
| skill_find | task | Finds the right skill in the catalog of turned-off skills and returns its text |
| memory_recall | query, budget (200–8000, default 1500), deep (default false) | Returns only the memory and project snippets that serve the task, within the token cap |
| project_find | query, top (1–20, default 5) | Says in which project files the code that serves the task is; returns paths and symbols |

`skill_find`, `memory_recall`, `project_find`, `jev_route` and `memory_recover` write the send log, so they are not advertised as read-only.

Only `memory_status`, `memory_update`, `memory_recall`, `project_find` and `skill_find` are registered by default; `memory_search`, `memory_read`, `jev_route` and `memory_recover` require `allTools` (`--all-tools` or `JEV_GRAPHIFY_ALL_TOOLS=1`).

Privacy: `privacyOf(root, options)` in `src/files.mjs` resolves the mode, in this order: explicit `privacy` option, `privacy` key of `.jev-graphify.json`, and finally `ficha`. `recall` and `findSkill` use this function; in `ficha`, `recall` only does the cards step and `findSkill` does not send the text snippet of the finalists.

Daily cap: `jevGate(root, options)` in `src/files.mjs` decides, once per call, whether Jev can be used. It returns `jev: false` with `reason` equal to `turned_off`, `no_key` or `daily_limit`; in the last case it sums the day's (UTC) `input_tokens` in `sent.jsonl` (`usedToday`) and compares with `options.dailyTokens` (default 250 million; 0 turns the cap off). When the log is truncated by size, a `carry` line preserves the day's total.

`src/project.mjs` handles the project code. On an index with more than 60 clusters and at least 8 modules (top-level folders), `findInProject` first does a module step (purpose `project_modulos`, option `modulos`, default 5) and only asks about the clusters that have a file in the chosen modules; the strategy appears as `modulos` in the result. `walkCode(root, code)` lists the code files of the folders in `code.roots`, with the exclusions; `buildProject(root, code, { python })` copies those files to a temporary area in `.jev-graphify`, runs `src/graphify-project.py` (Graphify `extract --code-only`, with community clustering) and returns the index: per file, the cluster and up to 40 symbols; per cluster, labels, folders and files. `update` writes this index to `.jev-graphify/project.json` when `code` is configured. `findInProject(root, query, { top, nucleos })` does the search: with Jev and a large index, one `noul` question per cluster (purpose `project_nucleos`), the best `nucleos` stay (default 8) and then one question per file in them (`project_files`); with a small index (up to 12 clusters or 60 files), a single step; without Jev, local ordering by words. A stale index does not block the search: the result carries `stale: true` and `stale_files` (up to 10 changed, new or removed paths). The index keeps a stamp (size and date) per file; `refreshProject(root, code, index)` reanalyses only the files whose stamp changed, keeps the clusters and adds the changes up in `drift`; it returns `null` (and `update` redoes everything with `buildProject`) when the index is old and has no stamps, when `drift` exceeds `PARTIAL_MAX` (15% of the files, minimum 20) or when Graphify fails on the part. `update` reports `mode` (`incremental` or `full`) and `changed`; `update(root, { full: true })` and `--full` in the CLI force the rebuild.

`src/memory.mjs` has `loadMemory(root, { memoryDirs, autoMemory, home })` (Markdown memory folders, including the Claude Code one for the project), `loadProject(root)` (the project sources, read on the spot), `chunk(text, options)` (cutting into snippets) and `recall(root, query, options)`. `recall` does not depend on the index or on Graphify: it reads the files on every call. With Jev the questions are `noul`, in batches of up to 300 questions or 150 thousand characters, six batches at a time. Strategies (`strategy` in the result): `full`, one question per snippet over the whole collection, used when the text totals up to `FULL_SCAN_CHARS` (60 thousand characters) or when `deep` is true; `cards`, one question per file with the card (purpose `recall_cards` in the send log) and then one per snippet only for the `topFiles` best-placed files (default 12, from 1 to 50; a core option, not exposed in the MCP); `local`, without Jev. In `ficha` mode only the cards step exists. If any batch fails, the local ordering applies. `related` brings the memories cited by `[[name]]` in the returned snippets.

`diagnosis` has `kind` (`memory_gap`, `code_issue`, `inconclusive`), `reason`, literal `evidence` of the failure and `queries` (up to three). The tool does not generate the diagnosis by LLM: that is up to the client agent's reviewer. `examples/recover.json` is a fictitious request runnable via the CLI. Example:

```powershell
node src/cli.mjs recover --project examples/project --input examples/recover.json
```

Without a key or with `--no-jev`, `memory_gap` becomes `memory_pending`, with candidates the client can read and evaluate. `code_issue` does not call Jev and allows a fix with the context already loaded. `inconclusive` becomes `review_pending`. `context_limit` flags more than 12 thousand characters in the memories; the integrator must reduce the context.

The CLI uses the same functions. The `--project` option is mandatory; `--input` is a JSON file of up to 32 KiB. It does not accept keys or commands in arguments. MCP requests use strict validation with Zod. The MCP's standard output contains only the protocol; Graphify errors are summarised so as not to copy environment or private output.

Real generation: approved code files are copied to a temporary area inside `.jev-graphify`, without running that code. `graphify-bridge.py` checks the installed version and calls `graphify.cli.dispatch_command('extract')` with `--code-only --no-cluster --max-workers 1 --no-dedup`. It avoids the install/skills initializer of `python -m graphify`. The child environment does not receive the user's keys/API/configuration. The raw `graph.json` is validated and normalised into nodes/relations with authorized sources, together with snapshots of the sources. The temporary area is removed. There is no publication of a global graph.

Snapshots are written in an atomic file swap and protected by an update lock. The revision includes the list of sources, the hashes and their types. Reading checks revision and project. This protection does not make a local index resistant to a user who can already edit their files; origin/hash help trace changes, they are not a cryptographic signature of trust.
