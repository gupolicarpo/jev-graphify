# Jev + Graphify

**Give your coding agent the right file or memory for a fraction of a cent, instead of letting it read everything.**

An MCP server for Claude Code, Codex and other agent hosts. [Graphify](https://pypi.org/project/graphifyy/) organises your code into clusters with local analysis (no LLM), and [Jev](https://typesafe.ai), a very cheap decision model, picks the module, the cluster and the file your agent needs. The agent gets a short answer instead of burning tokens on search and re-reading.

Independent community package. Not an official product of Anthropic, OpenAI, Graphify or TypeSafe.

> Documentation in Portuguese (the original, more detailed): [README.pt-BR.md](README.pt-BR.md) · [measurements and limits](docs/COMPATIBILIDADE.md) · [API](docs/API.md)

## What was measured

All numbers come from the real Jev service. They are single runs on small test sets written by the author, so read them as evidence that the pipeline works, not as a benchmark. Details and limits are in [docs/COMPATIBILIDADE.md](docs/COMPATIBILIDADE.md).

| Task | Result | Cost per query |
|---|---|---|
| Find the right file in a real C# project (about 2,000 files), questions in Portuguese | top 3 in 22 of 24, top 5 in 23 of 24 | about 63k Jev input tokens (roughly $0.003), about 1 s |
| Same questions with plain keyword search | top 3 in 1 of 24 | free |
| Recall the right note from 167 real agent memory files (about 327k tokens) | first place in 12 of 13 | about 57k Jev tokens |
| Pick the right skill from a catalogue of 24 | 18 of 18 (keyword search: 11 of 18) | about 1.8k Jev tokens |

For the code search, the agent receives about 800 tokens (five file paths with their symbols). Indexing those 2,000 files took under 3 minutes the first time, with no LLM, and about 3 seconds after two files changed.

## What you get

Five tools are registered by default, about 540 tokens of tool definitions per session:

- `project_find`: tells the agent which files hold the code for a task. Returns paths and symbol names, never file contents.
- `memory_recall`: returns only the passages of memory and project notes that help with a task, inside a token budget. Reads Claude Code's per-project memory folder automatically.
- `skill_find`: keeps your skills switched off in the host (so their descriptions cost nothing) and hands the right one to the agent when a task needs it.
- `memory_update` and `memory_status`: build and check the local indexes.

Four older tools (`memory_search`, `memory_read`, `jev_route`, `memory_recover`) are available with `--all-tools`.

## Requirements

- Node.js 22 or newer
- Python 3.12 or 3.13 (for Graphify)
- A Jev API key from [TypeSafe](https://console.typesafe.ai/) for the selection steps. Without a key everything still runs with local keyword ranking, which is much weaker.

Tested on Windows, macOS and Linux (see the Actions tab).

## Install

Windows (PowerShell):

```powershell
npm ci --ignore-scripts
python -m venv .venv-graphify
.\.venv-graphify\Scripts\python.exe -m pip install -r requirements-graphify.lock
npm test
```

macOS or Linux:

```bash
npm ci --ignore-scripts
python3 -m venv .venv-graphify
./.venv-graphify/bin/python -m pip install -r requirements-graphify.lock
npm test
```

The plugin finds the `.venv-graphify` folder next to it on its own.

## Use it in your project

1. Create `.jev-graphify.json` in your project folder and say which folders are code:

```json
{
  "version": 1,
  "sources": [],
  "skills": [],
  "code": { "roots": ["."], "exclude": ["backups"] }
}
```

2. Build the index (minutes the first time on a large project, seconds afterwards):

```bash
node /path/to/jev-graphify/src/cli.mjs update --project /path/to/your-project
```

3. Connect your agent. For Claude Code, add this to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "jev-graphify": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/jev-graphify/src/cli.mjs", "mcp", "--project", "/path/to/your-project"]
    }
  }
}
```

4. Put your key in the `JEV_API_KEY` environment variable of the program that starts the agent. Never write it into project files.

Optional: add `--skills-dir /path/to/your/skills` to the arguments to enable `skill_find` over a folder of skills (one subfolder per skill, each with a `SKILL.md`).

Try it from the command line with a file containing `{ "query": "where is the invoice rounding done?", "top": 5 }`:

```bash
node /path/to/jev-graphify/src/cli.mjs find --project /path/to/your-project --input query.json
```

## Privacy and cost controls

- **Code search** sends the question, file paths and symbol names to TypeSafe. File contents are never sent.
- **Memory recall and skill search** send only cards by default (name, short description, section titles). To send full text for better accuracy, add `"privacy": "completo"` to `.jev-graphify.json`.
- Secret-looking strings are replaced with `[REDACTED]` before anything is sent. This lowers the risk; it does not catch every secret.
- Every request is logged, without content, in `.jev-graphify/sent.jsonl` inside your project.
- A daily cap on Jev input tokens per project (250 million by default, about $10.50 at the published price) switches the tools to local ranking when reached. Change it with `--jev-daily-tokens`, or turn Jev off with `--no-jev`.
- Graphify runs on a staged copy of your code inside `.jev-graphify`, in a reduced environment with no API keys. The plugin writes nothing outside that folder.

## Known limits

- Jev is in early access and needs a key. This package pins Graphify to version 0.9.107.
- Code search stops at the file, not at the line.
- With the default card-only privacy mode, recall can miss a detail that appears only in the middle of a note.
- The relevance thresholds were tuned on small test sets.
- Codex memories and session transcripts are not read.
- Most documentation is in Portuguese.

## License

MIT. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Jev is a proprietary external service of TypeSafe; this licence grants no rights or credits for it.
