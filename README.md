# Jev + Graphify

**Give your coding agent the right file or memory for a fraction of a cent, instead of letting it read everything.**

An MCP server for Claude Code, Codex and other agent hosts. [Graphify](https://pypi.org/project/graphifyy/) organises your code into clusters with local analysis (no LLM), and [Jev](https://typesafe.ai), a very cheap decision model, picks the module, the cluster and the file your agent needs. The agent gets a short answer instead of burning tokens on search and re-reading.

Independent community package. Not an official product of Anthropic, OpenAI, Graphify or TypeSafe.

> More: [measurements and limits](docs/COMPATIBILITY.md) · [API notes](docs/API.md) · [Português](README.pt-BR.md)

## What was measured

All numbers come from the real Jev service. They are single runs on small test sets written by the author, so read them as evidence that the pipeline works, not as a benchmark. Details and limits are in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). The Second Brain rows use a fictitious vault and questions written by the same AI author, so they are optimistic; the data and the runner are in [bench/second-brain](bench/second-brain).

| Task | Result | Cost per query |
|---|---|---|
| Find the right file in a real C# project (about 2,000 files), questions in Portuguese | top 3 in 22 of 24, top 5 in 23 of 24 | about 63k Jev input tokens (roughly $0.003), about 1 s |
| Same questions with plain keyword search | top 3 in 1 of 24 | free |
| Recall the right note from 167 real agent memory files (about 327k tokens) | first place in 12 of 13 | about 57k Jev tokens |
| Pick the right skill from a catalogue of 24 | 18 of 18 (keyword search: 11 of 18) | about 1.8k Jev tokens |
| Recall the right note from a 212-note Second Brain (synthetic, 40 questions in Portuguese), plugin 0.5.2 with the notes in a flat memory folder, Jev cards | first place in 22 of 34, in the answer in 31 of 34, 6 of 6 no-answer cases right | about 28,200 Jev tokens (about $0.0012) |
| Same vault, 0.6.0, Jev, default privacy (`ficha`) | first place in 26 of 34, in the answer in 31 of 34, 5 of 6 no-answer cases right; linked code file right in 30 of 32; `project_find` top 5 has the file in 31 of 32 | about 24,300 Jev tokens (about $0.0010) |
| Same vault, 0.6.0, Jev, `completo` | first place in 29 of 34, in the answer in 33 of 34, 6 of 6 no-answer cases right; code file right in 31 of 32; `project_find` top 5 in 32 of 32 | about 27,500 Jev tokens (about $0.0012) |
| Same vault, 0.6.0, no key (local ranking) | first place in 20 of 34 (baseline without key: 13); code file right in 31 of 32 | free |

For the code search, the agent receives about 800 tokens (five file paths with their symbols). Indexing those 2,000 files took under 3 minutes the first time, with no LLM, and about 3 seconds after two files changed.

## What you get

Five tools are registered by default, about 540 tokens of tool definitions per session (a sixth, `note_capture`, appears only if you configure a Second Brain inbox):

- `project_find`: tells the agent which files hold the code for a task. Returns paths and symbol names, never file contents. With a Second Brain, each file also lists the notes that link to it.
- `memory_recall`: returns only the passages of memory and project notes that help with a task, inside a token budget. Reads Claude Code's per-project memory folder automatically. With a Second Brain, it also returns your notes and the code files they link to.
- `skill_find`: keeps your skills switched off in the host (so their descriptions cost nothing) and hands the right one to the agent when a task needs it.
- `memory_update` and `memory_status`: build and check the local indexes.
- `note_capture` (only with `brain.inbox`): saves a short note into the Second Brain inbox. It never edits existing notes.

Four older tools (`memory_search`, `memory_read`, `jev_route`, `memory_recover`) are available with `--all-tools`.

## Second Brain

A Second Brain here is a folder of Markdown notes with `[[wikilinks]]`, the kind Obsidian, Foam, SilverBullet or Logseq keep. The plugin reads it so that one question to the agent returns the right notes and the code files those notes are about.

Turn it on in `.jev-graphify.json`:

```json
{
  "version": 1,
  "sources": [],
  "skills": [],
  "code": { "roots": ["."], "exclude": [] },
  "brain": {
    "roots": ["notes"],
    "exclude": ["Templates", "Archive/2019"],
    "private_tags": ["private"],
    "inbox": "Inbox/agent"
  }
}
```

`roots` are folders inside the project (same rules as `code.roots`). `exclude`, `private_tags` and `inbox` are optional. For a vault outside the project, add `--brain-dir /abs/path` (repeatable) to the startup arguments, or set `JEV_GRAPHIFY_BRAIN_DIRS` (absolute paths separated by `;` on Windows, `:` elsewhere) when loading as a plugin. Only the person who starts the server can set these; the model cannot. Then run `update`, which groups the notes and links them to the code index.

What the agent gets:

- `memory_recall` returns notes next to memory and project passages. Each note carries the code files it links to (up to 4, with their symbols) in `code`, and the whole answer has a top-level `code` list of files to open (up to 8).
- `project_find` adds `notes` (up to 3) to each file that notes link to. This comes from the index, with no Jev call.
- `note_capture` exists only when `brain.inbox` is set. It writes a new note, with title, tags, links and code paths, into the inbox folder of the first vault. It never overwrites or edits anything.

How a note is tied to code, from strongest to weakest: a `code:` list in the frontmatter, a link to a code file, a code file name or path written in the text, and a function or class name in backticks that exists in only a few files of the code index. Code links need the code index (`code` in `.jev-graphify.json`).

Superseded decisions: when a note says `superseded_by` (or another note says `supersedes`), the current decision is placed right before the old one, and it is pulled in if it was not among the results. The old note carries `superseded_by`, so the agent can see why it is outdated.

How the vault is grouped: Graphify clusters the notes and the code files they link to together (Leiden, the same method used for code), so notes on one subject land in one community even without links between them. If Graphify cannot run, notes are grouped by top-level folder and the `update` result says so. In a vault with more than 150 notes and at least 6 communities, Jev first picks the best 6 communities from short cards; the 20 notes that best match the question by keywords pass anyway, as a safety net.

Privacy:

- A note with `private: true` in its frontmatter, or with a tag listed in `private_tags`, never enters the index, the results, the cards sent to Jev or the link lists of other notes. It is only counted.
- Default (`ficha`): to TypeSafe goes one card per note (title, aliases, short description, type, status, tags, section titles, titles of up to 6 linked notes, up to 4 linked code paths) and, in large vaults, one card per community. Note text is not sent.
- With `"privacy": "completo"`, the text of the best-placed notes is also sent. As for memory, secret-looking strings are replaced before sending and every request is logged without content.
- Note text returned to the agent is untrusted data. Without a key or with `--no-jev`, nothing is sent.

The measurements are in the table above. They use a fictitious vault; the notes and the questions were written by the same AI author, the set is small and each mode was run once.

## Requirements

- Node.js 22 or newer
- Python 3.12 or 3.13 (for Graphify)
- A Jev API key from [TypeSafe](https://console.typesafe.ai/) for the selection steps. Without a key everything still runs with local keyword ranking, which is much weaker.

Tested on Windows, macOS and Linux (see the Actions tab).

## Quick start

Three steps: get the code, run one command, set your key.

```bash
git clone https://github.com/gupolicarpo/jev-graphify.git
node jev-graphify/src/cli.mjs setup --project /path/to/your-project
```

`setup` installs the Node dependencies, creates the Python environment for Graphify, writes `.jev-graphify.json` and `.mcp.json` into your project (it never overwrites what is already there; it adds the server to an existing `.mcp.json`), and builds the code index. Then put your key in the `JEV_API_KEY` environment variable of the program that starts your agent, and open the agent in the project folder.

The rest of this page is the same thing done by hand, plus the options.

## Install by hand

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

## Context hook (opt-in)

The plugin ships a `UserPromptSubmit` hook (`hooks/hooks.json`, `src/hook.mjs`). When it is on, it finds the notes and code most likely to matter for the prompt and injects them into the prompt before the agent starts, in under 9,800 characters (Claude Code 2.1.325 moves hook output of 10,000 characters or more to a file).

It is off by default. To turn it on for a project, add to `.jev-graphify.json`:

```json
{ "hook": "full" }
```

- `"full"` (or `true`): notes, code excerpts and file outlines. `"compact"`: a shorter pointer list ("where to look"). Absent, `false` or any other value: the hook does nothing.
- `JEV_GRAPHIFY_HOOK=1` forces it on without config (integrators, benchmarks); `JEV_GRAPHIFY_HOOK=0` forces it off. `JEV_GRAPHIFY_CONTEXT=compact|full` overrides the mode.
- When off, it reads the config and returns at once: no Jev call, no output.

**Use it** on large note vaults (thousands of notes) when you ask about decisions and history. **Do not use it** when the project memory already fits Claude Code's native memory and the code is well named: we measured no gain and lower answer quality (see `docs/COMPATIBILITY.md`, 0.7.0).

Latency is 8 to 13 s per prompt on a 3,000-note vault. The hook gives up after 45 s (`JEV_GRAPHIFY_HOOK_TIMEOUT_MS`) and fails open: the prompt goes through unchanged. Privacy is the same as everywhere else: the `privacy` setting (`ficha` by default) decides what goes to Jev. The large-vault savings were measured with `"privacy": "completo"`; with the default `ficha` the ranking sees less text and was not measured.

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
- Second Brain: only Markdown notes are read (up to 10,000 notes, 64 MiB in total, 256 KiB per note; larger notes are skipped). A note is tied to code only through file names, paths and symbols that appear in it, so a note that describes the code in other words is not linked. Without a key, local ranking always fills the budget and can never answer "nothing found". The measurements above use synthetic notes and questions and may overstate the results on a real vault.

## License

MIT. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Jev is a proprietary external service of TypeSafe; this licence grants no rights or credits for it.
