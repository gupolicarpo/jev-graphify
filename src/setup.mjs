import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const plugin = fileURLToPath(new URL('..', import.meta.url));
const venvPython = () => resolve(plugin, process.platform === 'win32' ? '.venv-graphify/Scripts/python.exe' : '.venv-graphify/bin/python');
// Comandos fixos, sem nada vindo do usuário; `shell` é preciso para o npm.cmd no Windows.
const run = (command, cwd) => new Promise((done, fail) => {
  const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let err = ''; child.stderr.on('data', d => { err = (err + d).slice(-600); });
  child.on('error', fail); child.on('close', code => code === 0 ? done() : fail(Error(command + ' exited with code ' + code + ': ' + err.trim().split(/\r?\n/).slice(-2).join(' | '))));
});
const readJson = async file => { try { return JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, '')); } catch (e) { if (e.code === 'ENOENT') return null; throw Error('File contains invalid JSON, left unchanged: ' + file); } };
// Prepara tudo de uma vez: dependências, ambiente do Graphify, configuração do projeto, conexão MCP e índice.
// Nunca sobrescreve o que já existe: completa o que falta e diz o que fez.
export async function setup(project, { install = true, index = true, update } = {}) {
  project = await realpath(project);
  if (!(await lstat(project)).isDirectory()) throw Error('Invalid project folder: ' + project);
  const steps = [];
  if (install) {
    if (existsSync(resolve(plugin, 'node_modules', 'zod'))) steps.push('Node dependencies: already installed');
    else { await run('npm ci --ignore-scripts', plugin); steps.push('Node dependencies: installed'); }
    if (existsSync(venvPython())) steps.push('Graphify environment: already exists');
    else {
      await run((process.platform === 'win32' ? 'python' : 'python3') + ' -m venv .venv-graphify', plugin);
      await run('"' + venvPython() + '" -m pip install --disable-pip-version-check -q -r requirements-graphify.lock', plugin);
      steps.push('Graphify environment: created in .venv-graphify');
    }
  }
  const configFile = resolve(project, '.jev-graphify.json'), config = await readJson(configFile);
  if (!config) { await writeFile(configFile, JSON.stringify({ version: 1, sources: [], skills: [], code: { roots: ['.'], exclude: [] } }, null, 2) + '\n', { flag: 'wx' }); steps.push('.jev-graphify.json: created, with the whole project as code'); }
  else steps.push('.jev-graphify.json: already existed, kept' + (config.code ? '' : ' (no "code" key: code search stays off until you add it)'));
  const mcpFile = resolve(project, '.mcp.json'), mcp = await readJson(mcpFile);
  const entry = { type: 'stdio', command: 'node', args: [resolve(plugin, 'src', 'cli.mjs').replace(/\\/g, '/'), 'mcp', '--project', project.replace(/\\/g, '/')] };
  if (mcp?.mcpServers?.['jev-graphify']) steps.push('.mcp.json: the jev-graphify server was already there, kept');
  else {
    if (mcp && (typeof mcp !== 'object' || Array.isArray(mcp))) throw Error('.mcp.json has an unexpected format, left unchanged: ' + mcpFile);
    await writeFile(mcpFile, JSON.stringify({ ...(mcp ?? {}), mcpServers: { ...(mcp?.mcpServers ?? {}), 'jev-graphify': entry } }, null, 2) + '\n');
    steps.push(mcp ? '.mcp.json: jev-graphify server added to the existing ones' : '.mcp.json: created');
  }
  let indexed = null;
  if (index) { indexed = await update(project); steps.push('index: ' + (indexed.project ? indexed.project.files + ' code files in ' + indexed.project.nucleos + ' clusters' : 'memory updated (no code configured)')); }
  const key = Boolean(process.env.JEV_API_KEY);
  return {
    status: 'ready', project, steps, index: indexed,
    next: [
      key ? 'The JEV_API_KEY key is in the environment.' : 'The key is missing: set JEV_API_KEY in the environment of the program that opens the agent (without it the search is local, keyword-based and much weaker).',
      'Open (or restart) the agent in the project folder and approve the jev-graphify server.',
      'Suggestion: add .jev-graphify/ to the project .gitignore.',
    ],
  };
}
