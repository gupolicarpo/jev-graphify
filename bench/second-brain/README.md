# Second Brain benchmark

A fictitious dataset and a runner to measure whether `memory_recall` and `project_find` return the right note of a Second Brain and the code files that note links to. It is not part of the release ZIP and `npm test` does not run it. The files are in Portuguese; `LEIA-ME.md` describes them.

- `vault/`: 218 Markdown notes (Obsidian style, with `.obsidian/`), 3 of them private and 3 templates.
- `faturamento/`: an invented Python billing project (36 code files, 47 with `__init__`).
- `casos.json`: 40 questions in Portuguese with the expected note and code files.
- `rodar-segundo-cerebro.mjs`: the runner. `verificar-conjunto.mjs`: checks that cases, paths, symbols and links point to things that exist.
- `resultado-*.json`: the stored results (summary and one row per question, no note text, no key). `*-antes-da-correcao.json` are the first runs, before the superseded-decision ordering rule.

## Run

From the repository root, with the Node dependencies installed:

```
node bench/second-brain/verificar-conjunto.mjs
node bench/second-brain/rodar-segundo-cerebro.mjs base-local
node bench/second-brain/rodar-segundo-cerebro.mjs preparar
node bench/second-brain/rodar-segundo-cerebro.mjs local
JEV_API_KEY=... node bench/second-brain/rodar-segundo-cerebro.mjs jev-ficha
JEV_API_KEY=... node bench/second-brain/rodar-segundo-cerebro.mjs jev-completo
JEV_API_KEY=... node bench/second-brain/rodar-segundo-cerebro.mjs base-jev
```

- `verificar-conjunto.mjs`: consistency of the dataset; prints `OK` when nothing is wrong.
- `base-local` and `base-jev`: baseline without the feature (the vault flattened into one memory folder, as in plugin 0.5.2), without and with a key.
- `preparar`: copies `faturamento/` to `projeto/`, adds `brain.exclude: ["Templates"]` and runs `update` with the vault as an external vault. It needs Graphify: set `JEV_GRAPHIFY_PYTHON` to a Python with `graphifyy==0.9.107` (see the main README), or the grouping falls back to folders.
- `local`: recall and `project_find` with the Second Brain and no key (needs `preparar` first).
- `jev-ficha` and `jev-completo`: the same with Jev, privacy `ficha` (cards) or `completo` (note text). They need `preparar` first and `JEV_API_KEY` in the environment.
- `TESTE_MAX=n` limits the number of questions.

Each run writes `resultado-<mode>.json` next to the runner, overwriting the stored one; copy it first if you want to keep it. The working folders `projeto/`, `projeto-base/` and `base-memoria/` are created inside this folder and are ignored by git. The key is read only from `JEV_API_KEY` and is never printed or stored.

## Privacy and cost

The modes with Jev (`jev-ficha`, `jev-completo`, `base-jev`) send the fictitious vault to TypeSafe: cards of the notes, and in `jev-completo` also passages of their text. Private notes and templates are left out. The runner prints a warning before sending. At the published price (US$0.042 per million input tokens) a full run of 40 questions costs a few cents.

## Caveats

- The notes and the questions are synthetic and were written by the same AI author, so the vocabulary of one matches the other more than in a real vault: results are optimistic.
- 40 questions, 6 per type, and single runs: differences of one or two cases are within run-to-run variation.
- Without a key, local ranking always fills the token budget, so it cannot answer "nothing found" and "in the answer" is inflated; look at first place.
- The results in this folder are those quoted in `docs/COMPATIBILITY.md`, from runs on 19 Nov 2026. Jev results can change with the service.
