# Verified compatibility — 0.5.2 (history since 0.1.1)

Date: 12 Nov 2026. Environment: Windows x64, Node.js 24.19.0, npm 11.17.0, CPython 3.13.15. All data used was fictitious. No real paid call to Jev or to an LLM was made.

| Part | What was run | Result and limit |
|---|---|---|
| Core and CLI | 24 local tests of search, context, simulated Jev and MCP | Passed; does not prove the quality of selection by a real Jev |
| Graphify 0.9.107 | Real AST generation, update, node removal, no change, and subprocess failure | Passed; local code, no LLM and no communities |
| Demonstration | Real Python test fails, rule recovered, scripted executor fixes it, same test passes | Passed; review, Jev and executor simulated |
| MCP SDK 2.4.0 | Real client over stdio lists/calls tools, validates isolation and input error | Passed; local test process, not a commercial agent session |
| Legacy MCP | Handshake, listing and call on protocol 2025-11-25 | Passed; direct protocol test |
| Portable package | plugin.json and mcp.json against the official Agent Plugins 1.0.0 schemas | Valid; no installation on the host |
| Codex | Local CLI 0.167.0-alpha.3.2 identified; TOML example parsed; manifests conform to the official docs | No real session using the skill/MCP and no plugin installation |
| Claude Code | Manifest and example prepared according to the official documentation | CLI absent; no official validation by the CLI and no real session |
| Linux (0.1.1) | ZIP extracted, npm ci, Python 3.13.18 venv, Node 22.23.4: 27 tests, real Graphify and demonstration | Passed; macOS not verified |
| Claude Code validator (0.1.1) | `claude plugin validate` 2.1.322 | Passed; only a warning about a missing icon (matters only for the catalog) |
| Jev HTTP | Public contract compared, and responses/errors/cancellation simulated | No validation with a real account; quality, cost and latency not measured |
| Clean install | ZIP extracted into a new folder, npm ci, new Python environment, tests and demonstration | Evidence summarised in validation-summary.json |

The suite includes search in the body of the texts, graph traversal, sources/versioning, stale index, snapshot tampering, index copied between projects, directory traversal, junction, file size limit, no call without opt-in, insufficient confidence, invalid choice, invalid JSON, response limit, timeout, cancellation and invented evidence.

The recovery flow was rehearsed with fictitious data and a scripted executor. A real session still needs to confirm: discovery/use of the skills; loading of the manifests; inheritance and expansion of variables; the host's effective permissions; round trip to the same executor and application of the original tests. The main model remains defined by the host.

Updating is explicit. There is no watcher, no automatic installation of Graphify, no automatic promotion of learnings, no automatic resumption of chats, no execution of commands coming from memories, no universal reading of formats and no promise of savings. The list of sources is the authorization to index, not an authorization to send content to Jev.

`npm audit` in the verified environment reported zero known vulnerabilities in the 14 npm dependencies, on the date of the test. No vulnerability audit of the Python libraries was done; this is not a guarantee that there are no flaws. Versions are pinned to allow reproduction.

Working logs with local paths stay outside the ZIP. The distributed summary keeps only versions, generic commands, results and counts.

## Changes in 0.1.1

- Search tolerates variations of the same word (common prefix of at least 5 letters): "arredondar" finds "arredondamento"; "fatura" finds "faturas".
- Plugin launcher uses the current folder when the host does not pass on `JEV_GRAPHIFY_PROJECT`/`CLAUDE_PROJECT_DIR`.
- Graphify failure reports the real reason (Python missing, package missing, timed out, or the end of the error).
- Without `JEV_GRAPHIFY_PYTHON`, uses `python3` outside Windows.
- Three new tests cover these changes (27 in total). A real agent session in Codex/Claude Code is still pending.

## Changes in 0.1.2

- Search: the graph bonus counts once per file, not per symbol; a code file with many nodes no longer overtakes a document just because of its size.
- `memory_recover` with several queries keeps the best score of each reference and reorders the list before the cut.
- Without `JEV_GRAPHIFY_PYTHON`, uses the `.venv-graphify` environment in the plugin folder, if it exists, before the system Python.
- The update lock stores the PID and is taken over when the owning process has already ended or after 3 minutes; it is no longer necessary to delete it by hand.
- Source errors say which path failed; a file that is not UTF-8 has its own message.
- The MCP server version and the ZIP name come from `package.json`; a test checks the manifests.
- Tests: the server closes before the temporary folder is cleaned up (in 0.1.1 a test failed with EBUSY on Windows and `npm test` did not finish) and `npm test` uses `--test-force-exit`. Six new tests (33 in total).
- 0.1.2 was not packaged as a ZIP; the changes above continue in 0.2.0. Verified in 0.1.2 only on Windows x64 (Node 24.19.0, CPython 3.13.15): suite, real Graphify and demonstration. The Linux, Claude Code validator and clean-install-from-ZIP checks are from 0.1.1 and were not repeated.

## Changes in 0.2.0

- **Jev on when there is a key.** With `JEV_API_KEY` in the environment, Jev is used; `--no-jev` turns it off. `--allow-paid-jev` is still accepted and does nothing. Note: anyone who already had the key in the environment and did not use `--allow-paid-jev` will now make paid calls.
- **Skills on demand.** New tool `skill_find` (7 tools in total) and `skill` command in the CLI: finds the right skill in a catalog of turned-off skills (`--skills-dir` or `JEV_GRAPHIFY_SKILLS_DIR`, plus the skills listed in the project) and returns its text. It follows the "skill suggestion" recipe published by TypeSafe, in two requests; the thresholds are those of the recipe and were not calibrated here.
- **Jev client.** `choice` and `noul` questions, up to two retries on 429/529, response limited to 256 KiB. The core no longer reads the key from the environment; only the entry points do.
- **Privacy.** Cleaning of snippets that look like secrets before sending, and a record of each request, without content, in `.jev-graphify/sent.jsonl`. `skill_find`, `jev_route` and `memory_recover` are no longer advertised as read-only because they write this record.
- Verified in 0.2.0 only on Windows x64 (Node 24.19.0, CPython 3.13.15): 53 tests, real Graphify and demonstration. The automatic tests use a simulated Jev. The skill search was checked once with the real service (`jev-latest`, 12 Nov 2026), with fictitious data: catalog of 24 skills and 18 requests (15 with a right skill, 3 with none). Result: 18 of 18, against 11 of 18 for the local search; 33 requests, 33,051 input tokens (about $0.0014) and 0.4 s on average per search. This is a single run, with cases written by whoever ran the test and easier than real use; it is not a measure of accuracy in production. `jev_route` and `memory_recover` were not exercised with the real service.

## Changes in 0.3.0

- **Recall with a token cap.** New tool `memory_recall` (8 tools in total) and `recall` command in the CLI: returns only the memory and project snippets that serve the task, within a token cap. It reads the Claude Code Markdown memories for the project (found automatically; `--no-auto-memory` turns this off), other folders given by `--memory-dir`/`JEV_GRAPHIFY_MEMORY_DIRS` and the project sources. It does not depend on the index or on Graphify.
- **Privacy.** By default (`completo`) the text of the snippets, including the memories, goes to TypeSafe on every query; `--privacy ficha` sends only the title and a short description.
- **Not included:** Codex memories (SQLite database), session transcripts and marking sources as "never send".
- Verified in 0.3.0 only on Windows x64 (Node 24.19.0, CPython 3.13.15): 76 tests, real Graphify and demonstration.
- Test with the real service (`jev-latest`, 12 Nov 2026), fictitious data: 30 memories (about 1,900 tokens in total) and 24 requests, cap of 600 tokens. The right memory came first in 21 of 22 requests and was in the response in 22 of 22; the 2 requests with no matching memory returned nothing. The response averaged 83 estimated tokens. With the local ordering, without Jev: 17 of 22 first, 549 tokens on average and neither of the 2 requests without a memory recognised. Jev cost: 96,092 input tokens across the 24 queries (about $0.004); 0.25 s on average. **Limits of this number:** the relevance cutoffs were tuned on this same set, which is small and written by whoever ran the test; the whole collection fits in 1,900 tokens.
- Test with the real service on a real collection (Claude Code memories from a project of the test author, 12 Nov 2026): 166 files, 839 snippets, about 327 thousand estimated tokens; 15 requests paraphrased from the descriptions of 13 memories, plus 2 with no matching memory; cap of 1,500 tokens. The right memory came first in 12 of 13 and was in the response in 13 of 13; the 2 requests without a memory returned nothing. With the local ordering: 3 of 13 first, 5 of 13 in the response, 0 of 2. Average response of 1,061 estimated tokens. **Cost:** each query reads the whole collection, in 10 parallel requests: about 441 thousand Jev input tokens (close to $0.0185) and 1.1 s per query. The same question repeated swapped the order of the top two snippets between two runs.
- **Two-step query** (file cards first, text only of the best 12), added after the measurement above. On the same collection and the same 15 requests: 12 of 13 first, 13 of 13 in the response, 2 of 2 without a memory; about 57 thousand Jev input tokens (close to $0.0024) and 0.9 s per query, or 7.7 times less than the full read. The expected memory was 1st in the cards step in 12 requests and 2nd in one. **Measured limit:** these 13 requests were written from the memory descriptions, which favors the cards. In 5 requests about details that appear only in the middle of the text, the cards query brought the expected memory in 2; the full read (`deep`), in 5, at the cost of the full read. Enriching the card with rare terms from the text or using per-section cards was measured and did not help (14 and 13 of 18 among the top 12, against 15 of 18 for the simple card, at higher cost).
- **Experiment not yet incorporated into the plugin** (12 Nov 2026, same collection, 18 requests: the 13 above plus the 5 detail ones). A cheap model (Claude Haiku) read each memory once and wrote an enriched card (summary, up to 14 facts and key terms; about 1.25 million Haiku tokens for the 167 files) and then grouped the memories into 20 clusters with a label and summary. Position of the expected memory in the cards step, among the top 12: simple card, 15 of 18, with 19.6 thousand Jev tokens per request; enriched card on all files, 18 of 18, with 103 thousand; **clusters first (the best 3) and enriched card only inside them, 17 of 18, with 19.2 thousand**. In other words, the clusters made the enriched card as cheap as the simple one, with better accuracy. Limits: small set, questions written by whoever ran the test, a single run; in this experiment the extraction was done by a Claude model, not by Graphify.
- **The same test with the real Graphify 0.9.107** (12 Nov 2026), in the mode where the host agent does the semantic extraction: 17 Claude Haiku subagents followed Graphify's own extraction text (about 1.6 million Haiku tokens) and Graphify's code merged, deduplicated, built the graph and clustered. Result: 1,149 nodes, 888 links and 328 communities, 93 of them with a single node and none covering more than 3 files; that is, for memory notes the graph ended up as islands per file and did not form thematic clusters. In the search: Graphify communities as routing, 14 of 18 among the top 12, with 31 thousand Jev tokens per request; file card with the concepts Graphify extracted from it, 16 of 18, with 32.5 thousand. The two requests that this card missed ask for a rule or a procedure, not a name: the graph stores entities (classes, files, items), and the fact cards store sentences. This test was on memory notes; the test on code, where Graphify is strong, is in the next item. The direct path (`graphify extract` with a provider) was not tested: the OpenAI key available was invalid and the Claude command line was not authenticated.
- **Graphify on code, with Jev choosing** (12 Nov 2026; experiment, not yet incorporated into the plugin). Real project of a C# mod, about 2,000 files and 18.7 MB of code. Graphify 0.9.107 ran with local analysis only (`--code-only`, no LLM, 160 s): 28,376 nodes, 83,642 links, 667 communities. After removing copies and artifacts, 1,999 files remained in 586 clusters (each file in the cluster that concentrates its nodes). Test: 24 questions in Portuguese, one per file from 24 different modules, written by a model from the file and without citing class or method names. With clusters (Jev picks 8 clusters from the cluster cards and then ranks only their files, by each one's symbol card): right file 1st in 19 of 24, among the top 3 in 22, among the top 5 in 23; about 146 thousand Jev input tokens (close to $0.006) and 0.6 s per question. Without clusters (Jev ranks the cards of the 1,999 files), measured on 12 of the 24: 1st in 9 of 12 and among the top 3 in 11, with 340 thousand tokens per question; on those same 12, with clusters: 11 and 11. The right cluster was among the top 3 in 21 of 24 and among the top 8 in 23. The local keyword search found the file among the top 3 in 1 of 24. Limits: questions generated from the files themselves, a single run, and the measure goes as far as finding the file, not the passage inside it. The clusters step accounts for almost all of the cost; choosing the module first and then the cluster should lower it, but this was not measured.

## Changes in 0.4.0

- **Search in the project code by Graphify clusters.** New `code` key in `.jev-graphify.json` (code folders and exclusions), new index `.jev-graphify/project.json` generated by `update`, new tool `project_find` and `find` command in the CLI. Graphify runs on a copy of the files, with local analysis only and with clustering on; Jev receives the question, paths and symbol names, never the text of the code. A stale index does not block the search.
- `update` no longer calls Graphify when no listed source is code (the classic graph stays empty, as before).
- Verified in 0.4.0 only on Windows x64 (Node 24.19.0, CPython 3.13.15): 98 tests, 2 tests with the real Graphify and demonstration.
- **End-to-end verification with the plugin** (12 Nov 2026), on a copy of the same C# project from the experiment above: `update` indexed 1,945 files in 554 clusters in 158 s (1.7 MB index). The same 24 questions through the `project_find` function, with the real Jev: right file 1st in 16, among the top 3 in 21 and among the top 5 in 23; about 142 thousand Jev input tokens (close to $0.006), 4 requests and 0.9 s per question; the response to the agent had about 820 estimated tokens (5 files with symbols). The previous experiment, with another index, had given 19, 22 and 23: the difference comes from the index (there it also included project files and scripts) and from Jev's own variation between runs. This verification revealed and fixed an error: the plugin refused files in folders named `config`. The limits of the experiment still apply: questions generated from the files, a single run, and the search goes as far as the file, not the passage.
- **Module step** (added after the verification above). Jev first picks 5 modules (top-level folders), then the clusters that have a file in them and finally the files. Measured before it went into the plugin, on the same index and the same 24 questions: the right module was among the top 5 in 24 of 24; with 3 modules, 15/22/22 (1st, among 3, among 5) for about 48 thousand tokens; with 5, 17/22/22 for 61 thousand; with 8, 18/23/23 for 93 thousand. Through the plugin, with 5 modules: 17, 22 and 23, with about 64.5 thousand Jev input tokens (close to $0.0027), 3 requests and 1.0 s per question, against 142 thousand tokens without the module step.
- **Fewer tools by default.** Five tools registered (about 540 definition tokens per session, by character count) instead of nine (about 1,190); the four from the old flow require `--all-tools`.
- **Daily Jev token cap** per project (default 250 million, close to $10.50 per day at the published price; `--jev-daily-tokens`), checked once per call. Verified through the CLI: with the cap below what was already spent that day, `find` answered `local` with `reason: "daily_limit"` and no request.
- Total tests in 0.4.0 after these changes: 111, plus 2 with the real Graphify. Linux, the Claude Code validator, the clean install from the ZIP and a real agent session were not repeated.

## Changes in 0.4.1

- **Large module split.** On first use on the real project (not the copy), a single module had 719 of the 1,945 files; its card did not represent the content and it was discarded in the module step, so questions about that code failed. Now a module with more than 100 files is split by subfolders, up to three levels (37 modules became 122 in that project), and each module's card lists the file names before the symbols.
- Measured on the real project, with the real Jev (13 Nov 2026): a real question about code in that module, which previously did not bring the right file among the 5, now brought it 1st. The 24 reference questions came out at 17 1st, 21 among the top 3 and 23 among the top 5, with about 63 thousand Jev tokens per question (before: 17, 22 and 23, with 64.5 thousand); the difference of one question is within the variation between runs.
- Another real question about the same module is still wrong. The right module is now the first one chosen, but the right file does not appear among the 5; the failure is in the clusters or files step.
- 112 automatic tests.

## Changes in 0.4.2

- **Partial update of the code index.** On the real project the index was minutes behind, because the code is edited all the time and redoing everything takes 2 to 3.5 minutes. Now the index keeps a stamp per file and `update` reanalyses only the changed, new or removed files; clusters are kept and a new file inherits the cluster of its folder neighbors. The full rebuild happens the first time (indexes from earlier versions have no stamps), when the accumulated changes pass 15% of the files and with `update --full`.
- The search now says which files changed since the index (`stale_files`), and `status` reports how many (`changed`).
- Measured on the real project (13 Nov 2026, 1,945 files): full rebuild in 130 s; with 2 files marked as changed, `update` finished in 2.9 s in `incremental` mode, restored the symbols of both and `status` went back to `current`. The change was simulated by swapping the stamp of those files in the plugin's index, without touching the code. After that, the 24 reference questions gave 17 1st, 22 among the top 3 and 24 among the top 5, with about 63 thousand Jev tokens per question.
- Known limit: since the clusters are not recalculated in the partial update, a large reorganization of the code is only reflected in them on the full rebuild.
- 113 automatic tests; the 2 tests with the real Graphify cover the partial update (changed, new and removed file).

## Changes in 0.5.0

- **Privacy: the default became `ficha`.** With no configuration, the text of the memories and the snippet of the skills' text are not sent to Jev; only cards go (name, short description, titles). The full text is turned on per project with `"privacy": "completo"` in `.jev-graphify.json`, or by the startup arguments. Anyone who used 0.4.x and wants the old behavior needs to add this key. The code search does not change: it never sent the text.
- **Other systems.** The reduced environment in which Graphify runs now also isolates the home folder outside Windows (`HOME` and XDG folders point to the temporary area) and passes on `TMPDIR` and the system language. Verified on Linux (Ubuntu 24.04 under WSL2, Node 22.22, Python 3.12.3): 117 tests, 2 tests with the real Graphify and the demonstration, with nothing written to the home folder. **macOS was not verified on a real machine**; the repository includes an automatic test for Windows, macOS and Linux, which runs on GitHub on every push.
- The documentation no longer cites file names and questions from the private project used in the measurements.
- 117 automatic tests.

## Changes in 0.5.1

- **`setup` command.** One command prepares everything: Node dependencies, Graphify environment, `.jev-graphify.json` and `.mcp.json` in the project and the code index. It does not overwrite existing files; in a `.mcp.json` that already has other servers, it only adds its own.
- Main README in English; the Portuguese text stays in `README.pt-BR.md`.
- The first push to GitHub ran the automatic test successfully on Windows, macOS and Linux (Node 22, Python 3.13), including the real Graphify and the demonstration: macOS now counts as verified.
- 119 automatic tests.

## Changes in 0.5.2

- **English texts.** The tool descriptions, the messages (errors, `setup`, result notes), the plugin skill and the labels of the cards sent to Jev were switched to English. Names of fields, options and values of the data format did not change (`nucleos`, `modulos`, `completo`, `ficha`, etc.).
- Since the card labels changed, the 24 reference questions were repeated on the real project with the real Jev (13 Nov 2026): 18 1st, 22 among the top 3 and 24 among the top 5, with about 63 thousand tokens per question, with no regression.
- Install from scratch through `setup` verified on Windows (88 s) and Linux; and, on Windows, the full path up to the search through the MCP server with the real Jev on a 27-file project: right file 1st in 5 of 6 questions and among the top 3 in 6 of 6.
