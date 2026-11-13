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
  child.on('error', fail); child.on('close', code => code === 0 ? done() : fail(Error(command + ' terminou com código ' + code + ': ' + err.trim().split(/\r?\n/).slice(-2).join(' | '))));
});
const readJson = async file => { try { return JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, '')); } catch (e) { if (e.code === 'ENOENT') return null; throw Error('Arquivo com JSON inválido, não foi alterado: ' + file); } };
// Prepara tudo de uma vez: dependências, ambiente do Graphify, configuração do projeto, conexão MCP e índice.
// Nunca sobrescreve o que já existe: completa o que falta e diz o que fez.
export async function setup(project, { install = true, index = true, update } = {}) {
  project = await realpath(project);
  if (!(await lstat(project)).isDirectory()) throw Error('Pasta do projeto inválida: ' + project);
  const steps = [];
  if (install) {
    if (existsSync(resolve(plugin, 'node_modules', 'zod'))) steps.push('dependências do Node: já instaladas');
    else { await run('npm ci --ignore-scripts', plugin); steps.push('dependências do Node: instaladas'); }
    if (existsSync(venvPython())) steps.push('ambiente do Graphify: já existe');
    else {
      await run((process.platform === 'win32' ? 'python' : 'python3') + ' -m venv .venv-graphify', plugin);
      await run('"' + venvPython() + '" -m pip install --disable-pip-version-check -q -r requirements-graphify.lock', plugin);
      steps.push('ambiente do Graphify: criado em .venv-graphify');
    }
  }
  const configFile = resolve(project, '.jev-graphify.json'), config = await readJson(configFile);
  if (!config) { await writeFile(configFile, JSON.stringify({ version: 1, sources: [], skills: [], code: { roots: ['.'], exclude: [] } }, null, 2) + '\n', { flag: 'wx' }); steps.push('.jev-graphify.json: criado, com o projeto inteiro como código'); }
  else steps.push('.jev-graphify.json: já existia, mantido' + (config.code ? '' : ' (sem "code": a busca no código fica desligada até você acrescentar)'));
  const mcpFile = resolve(project, '.mcp.json'), mcp = await readJson(mcpFile);
  const entry = { type: 'stdio', command: 'node', args: [resolve(plugin, 'src', 'cli.mjs').replace(/\\/g, '/'), 'mcp', '--project', project.replace(/\\/g, '/')] };
  if (mcp?.mcpServers?.['jev-graphify']) steps.push('.mcp.json: o servidor jev-graphify já estava lá, mantido');
  else {
    if (mcp && (typeof mcp !== 'object' || Array.isArray(mcp))) throw Error('Arquivo .mcp.json em formato inesperado, não foi alterado: ' + mcpFile);
    await writeFile(mcpFile, JSON.stringify({ ...(mcp ?? {}), mcpServers: { ...(mcp?.mcpServers ?? {}), 'jev-graphify': entry } }, null, 2) + '\n');
    steps.push(mcp ? '.mcp.json: servidor jev-graphify acrescentado aos que já existiam' : '.mcp.json: criado');
  }
  let indexed = null;
  if (index) { indexed = await update(project); steps.push('índice: ' + (indexed.project ? indexed.project.files + ' arquivos de código em ' + indexed.project.nucleos + ' núcleos' : 'memória atualizada (sem código configurado)')); }
  const key = Boolean(process.env.JEV_API_KEY);
  return {
    status: 'ready', project, steps, index: indexed,
    next: [
      key ? 'A chave JEV_API_KEY está no ambiente.' : 'Falta a chave: ponha JEV_API_KEY no ambiente do programa que abre o agente (sem ela a busca é local, por palavras, bem mais fraca).',
      'Abra (ou reinicie) o agente na pasta do projeto e aprove o servidor jev-graphify.',
      'Sugestão: acrescente .jev-graphify/ ao .gitignore do projeto.',
    ],
  };
}
