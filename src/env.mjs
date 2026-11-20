import { isAbsolute, delimiter } from 'node:path';
const known = ['--no-jev', '--allow-paid-jev', '--no-auto-memory', '--all-tools'];
// Lê as variáveis de ambiente do plugin; devolve { project, options } ou { error } com a mesma validação do servidor MCP.
export function optionsFromEnv(env = process.env, flags = []) {
  // Sem variável, usa a pasta onde o host iniciou o servidor (normalmente o projeto aberto).
  const project = env.JEV_GRAPHIFY_PROJECT || env.CLAUDE_PROJECT_DIR || process.cwd();
  const skillsDir = env.JEV_GRAPHIFY_SKILLS_DIR || undefined;
  const memoryDirs = (env.JEV_GRAPHIFY_MEMORY_DIRS || '').split(delimiter).filter(Boolean);
  const brainDirs = (env.JEV_GRAPHIFY_BRAIN_DIRS || '').split(delimiter).filter(Boolean);
  const privacy = env.JEV_GRAPHIFY_PRIVACY || undefined;
  const dailyRaw = env.JEV_GRAPHIFY_DAILY_TOKENS, dailyTokens = dailyRaw ? Number(dailyRaw) : undefined;
  const allTools = flags.includes('--all-tools') || env.JEV_GRAPHIFY_ALL_TOOLS === '1';
  const contextMode = env.JEV_GRAPHIFY_CONTEXT || undefined;
  const autoMemory = !flags.includes('--no-auto-memory') && env.JEV_GRAPHIFY_AUTO_MEMORY !== '0';
  let error;
  if (!project || !isAbsolute(project) || flags.some(f => !known.includes(f))) error = 'Invalid project path or unknown argument. Set JEV_GRAPHIFY_PROJECT to the absolute project path, or use the per-project MCP configuration from the README.';
  else if (skillsDir && !isAbsolute(skillsDir)) error = 'JEV_GRAPHIFY_SKILLS_DIR must be an absolute path.';
  else if (memoryDirs.some(d => !isAbsolute(d))) error = 'JEV_GRAPHIFY_MEMORY_DIRS must list absolute paths separated by "' + delimiter + '".';
  else if (brainDirs.some(d => !isAbsolute(d))) error = 'JEV_GRAPHIFY_BRAIN_DIRS must list absolute paths separated by "' + delimiter + '".';
  else if (privacy && !['completo', 'ficha'].includes(privacy)) error = 'JEV_GRAPHIFY_PRIVACY must be completo or ficha.';
  else if (contextMode && !['compact', 'full'].includes(contextMode)) error = 'JEV_GRAPHIFY_CONTEXT must be compact or full.';
  else if (dailyRaw && !/^\d{1,15}$/.test(dailyRaw)) error = 'JEV_GRAPHIFY_DAILY_TOKENS must be an integer greater than or equal to zero.';
  if (error) return { project, error };
  return { project, options: { jev: !flags.includes('--no-jev'), key: env.JEV_API_KEY, skillsDir, memoryDirs, ...(brainDirs.length ? { brainDirs } : {}), autoMemory, ...(privacy ? { privacy } : {}), ...(allTools ? { allTools } : {}), ...(dailyTokens !== undefined ? { dailyTokens } : {}), ...(contextMode ? { contextMode } : {}) } };
}
