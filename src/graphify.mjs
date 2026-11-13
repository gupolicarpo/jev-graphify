import { mkdir, mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { safePath, textFile } from './files.mjs';
const exec = promisify(execFile);
const bridge = fileURLToPath(new URL('./graphify-bridge.py', import.meta.url));
export const codeExtension = /\.(?:py|js|mjs|cjs|ts|tsx|jsx|go|rs|java|cs|c|h|cpp|rb|php|swift|kt|lua|sh|ps1)$/i;
// Ordem: variável explícita; ambiente .venv-graphify ao lado do plugin (o que o README manda criar); Python do sistema.
export function defaultPython(env = process.env, exists = existsSync) {
  if (env.JEV_GRAPHIFY_PYTHON) return env.JEV_GRAPHIFY_PYTHON;
  const local = fileURLToPath(new URL(process.platform === 'win32' ? '../.venv-graphify/Scripts/python.exe' : '../.venv-graphify/bin/python', import.meta.url));
  return exists(local) ? local : process.platform === 'win32' ? 'python' : 'python3';
}
export async function generateGraph(root, records, { python = defaultPython() } = {}) {
  const parent = await safePath(root, '.jev-graphify', true);
  await mkdir(parent, { recursive: true });
  const stage = await mkdtemp(resolve(parent, 'stage-'));
  try {
    for (const row of records.filter(r => r.kind === 'reference' && codeExtension.test(r.source))) {
      const dest = await safePath(stage, row.source);
      await mkdir(resolve(dest, '..'), { recursive: true });
      await writeFile(dest, row.body, { flag: 'wx' });
    }
    // No inherited API keys, provider configuration, Python hooks or personal home.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL'].includes(k.toUpperCase())));
    const profile = resolve(stage, 'isolated-profile'); await mkdir(profile);
    Object.assign(env, { USERPROFILE: profile, APPDATA: profile, LOCALAPPDATA: profile, HOME: profile, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile, GRAPHIFY_OUT: resolve(stage, 'graphify-out'), PYTHONIOENCODING: 'utf-8' });
    try { await exec(python, ['-I', bridge, stage], { cwd: stage, env, timeout: 60000, maxBuffer: 1048576, windowsHide: true }); }
    catch (e) {
      // O ambiente do subprocesso não tem chaves; mostrar só o fim do erro, para diagnóstico.
      const detail = e.code === 'ENOENT' ? 'Python não encontrado: ' + python : e.killed ? 'tempo esgotado (60 s)' : String(e.stderr || e.message || '').trim().split(/\r?\n/).slice(-3).join(' | ').slice(-400);
      throw Error('Graphify falhou. Confira Python e graphifyy==0.9.107 no ambiente local. O índice anterior foi preservado. Detalhe: ' + detail);
    }
    const graph = JSON.parse(await textFile(stage, 'graphify-out/graph.json', true, 8388608));
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links ?? graph.edges) || graph.nodes.length > 20000 || (graph.links ?? graph.edges).length > 80000) throw Error('Grafo inválido ou acima do limite.');
    const sources = new Set(records.map(r => r.source));
    const normalize = source => {
      if (typeof source !== 'string') return null;
      const file = source.replaceAll('\\', '/');
      const prefix = stage.replaceAll('\\', '/') + '/';
      const rel = file.startsWith(prefix) ? file.slice(prefix.length) : file.replace(/^\.\//, '');
      return sources.has(rel) ? rel : null;
    };
    const nodes = graph.nodes.filter(n => n.id !== undefined).map(n => ({ id: String(n.id), title: String(n.label ?? n.title ?? n.id).slice(0, 200), source: normalize(n.source_file ?? n.source) }));
    const ids = new Set(nodes.map(n => n.id));
    const edges = (graph.links ?? graph.edges).filter(e => ids.has(String(e.source)) && ids.has(String(e.target))).map(e => ({ source: String(e.source), target: String(e.target) }));
    return { generator: 'graphifyy', version: '0.9.107', mode: 'code-only/no-cluster', directed: graph.directed !== false, nodes, edges };
  } finally {
    const target = await realpath(stage), rel = relative(await realpath(parent), target);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Pasta temporária fora do escopo.');
    await rm(target, { recursive: true, force: true });
  }
}
