import { isAbsolute, delimiter } from 'node:path';
import { start } from './mcp.mjs';
// Sem variável, usa a pasta onde o host iniciou o servidor (normalmente o projeto aberto).
const project = process.env.JEV_GRAPHIFY_PROJECT || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const flags = process.argv.slice(2);
const skillsDir = process.env.JEV_GRAPHIFY_SKILLS_DIR || undefined;
const memoryDirs = (process.env.JEV_GRAPHIFY_MEMORY_DIRS || '').split(delimiter).filter(Boolean);
const privacy = process.env.JEV_GRAPHIFY_PRIVACY || undefined;
const dailyRaw = process.env.JEV_GRAPHIFY_DAILY_TOKENS, dailyTokens = dailyRaw ? Number(dailyRaw) : undefined;
const allTools = flags.includes('--all-tools') || process.env.JEV_GRAPHIFY_ALL_TOOLS === '1';
if (!project || !isAbsolute(project) || flags.some(f => !['--no-jev', '--allow-paid-jev', '--no-auto-memory', '--all-tools'].includes(f))) {
  console.error('Caminho do projeto inválido ou argumento desconhecido. Defina JEV_GRAPHIFY_PROJECT com o caminho absoluto do projeto, ou use a configuração MCP por projeto do README.');
  process.exitCode = 1;
} else if (skillsDir && !isAbsolute(skillsDir)) {
  console.error('JEV_GRAPHIFY_SKILLS_DIR deve ser um caminho absoluto.');
  process.exitCode = 1;
} else if (memoryDirs.some(d => !isAbsolute(d))) {
  console.error('JEV_GRAPHIFY_MEMORY_DIRS deve listar caminhos absolutos separados por "' + delimiter + '".');
  process.exitCode = 1;
} else if (privacy && !['completo', 'ficha'].includes(privacy)) {
  console.error('JEV_GRAPHIFY_PRIVACY deve ser completo ou ficha.');
  process.exitCode = 1;
} else if (dailyRaw && !/^\d{1,15}$/.test(dailyRaw)) {
  console.error('JEV_GRAPHIFY_DAILY_TOKENS deve ser um inteiro maior ou igual a zero.');
  process.exitCode = 1;
} else start(project, { jev: !flags.includes('--no-jev'), key: process.env.JEV_API_KEY, skillsDir, memoryDirs, autoMemory: !flags.includes('--no-auto-memory'), ...(privacy ? { privacy } : {}), ...(allTools ? { allTools } : {}), ...(dailyTokens !== undefined ? { dailyTokens } : {}) });
