#!/usr/bin/env node
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import * as core from './core.mjs';
import { findSkill } from './skills.mjs';
import { recall } from './memory.mjs';
import { findInProject } from './project.mjs';
export function parseArgs(argv) {
  const args = [...argv], command = args.shift(); let project, input, skillsDir, noJev = false, autoMemory = true, privacy, allTools = false, dailyTokens, full = false; const memoryDirs = [];
  while (args.length) {
    const flag = args.shift();
    if (flag === '--project' && args[0] && !project) project = resolve(args.shift());
    else if (flag === '--input' && args[0] && !input) input = resolve(args.shift());
    else if (flag === '--skills-dir' && args[0] && !skillsDir) skillsDir = resolve(args.shift());
    else if (flag === '--memory-dir' && args[0]) memoryDirs.push(resolve(args.shift()));
    else if (flag === '--no-auto-memory' && autoMemory) autoMemory = false;
    else if (flag === '--privacy' && args[0] && !privacy) privacy = args.shift();
    else if (flag === '--no-jev' && !noJev) noJev = true;
    else if (flag === '--full' && !full) full = true;
    else if (flag === '--all-tools' && !allTools) allTools = true;
    else if (flag === '--jev-daily-tokens' && args[0] && dailyTokens === undefined && /^\d{1,15}$/.test(args[0])) dailyTokens = Number(args.shift());
    else if (flag === '--allow-paid-jev') continue; // aceito e ignorado: configurações antigas
    else throw Error('Unknown or incomplete argument. See the README.');
  }
  if (!project) throw Error('Pass --project with the exact project folder.');
  return { command, project, input, skillsDir, noJev, memoryDirs, autoMemory, privacy, allTools, dailyTokens, full };
}
async function main() {
  if (process.argv[2] === '--help') { console.log('node src/cli.mjs <setup|init|status|update|search|read|route|recover|skill|recall|find|mcp> --project <folder> [--input <request.json>] [--skills-dir <folder>] [--memory-dir <folder>]... [--no-auto-memory] [--privacy <completo|ficha>] [--no-jev] [--jev-daily-tokens <n>] [--all-tools] [--full]'); return; }
  const { command, project, input, skillsDir, noJev, memoryDirs, autoMemory, privacy, allTools, dailyTokens, full } = parseArgs(process.argv.slice(2));
  const options = { jev: !noJev, key: process.env.JEV_API_KEY, skillsDir, memoryDirs, autoMemory, ...(privacy ? { privacy } : {}), ...(allTools ? { allTools } : {}), ...(dailyTokens !== undefined ? { dailyTokens } : {}) };
  if (command === 'setup') { const { setup } = await import('./setup.mjs'); console.log(JSON.stringify(await setup(project, { update: p => core.update(p) }), null, 2)); return; }
  if (command === 'mcp') { const { start } = await import('./mcp.mjs'); start(project, options); return; }
  let data = {};
  if (input) { const raw = await readFile(input); if (raw.length > 32768) throw Error('Request too large.'); data = JSON.parse(raw.toString('utf8')); }
  const handlers = { init: () => core.init(project), status: () => core.status(project), update: () => core.update(project, { full }), search: () => core.search(project, data.query, data.kind), read: () => core.read(project, data.id), route: () => core.route(project, data.task, options), recover: () => core.recover(project, data, options), skill: () => findSkill(project, data.task, options), recall: () => recall(project, data.query, { ...options, ...(data.budget ? { budget: data.budget } : {}), ...(data.deep === true ? { deep: true } : {}) }) };
  handlers.find = () => findInProject(project, data.query, { ...options, ...(data.top ? { top: data.top } : {}) });
  if (!handlers[command]) throw Error('Unknown command. Use --help.');
  console.log(JSON.stringify(await handlers[command](), null, 2));
}
// Safe public errors; do not print stacks, process environment or service bodies.
main().catch(e => { console.error(JSON.stringify({ error: String(e.message).replaceAll(process.env.JEV_API_KEY || '\u0000', '[REDACTED]') })); process.exitCode = 1; });
