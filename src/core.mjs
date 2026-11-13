import { realpath, mkdir, open, unlink, stat, readFile } from 'node:fs/promises';
import { hash, safePath, textFile, atomicJson, checkPath, appendSendLog, jevGate } from './files.mjs';
import { generateGraph, codeExtension } from './graphify.mjs';
import { choose } from './jev.mjs';
const configFile = '.jev-graphify.json';
const indexFile = '.jev-graphify/index.json';
export const tokens = text => [...new Set(String(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}_]{2,}/gu) || [])];
// Variações da mesma palavra (arredondar/arredondamento, fatura/faturas): prefixo comum longo.
function similar(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length); let n = 0;
  while (n < min && a[n] === b[n]) n++;
  return n >= Math.max(5, min - 3);
}
export const matches = (words, term) => words.some(w => similar(w, term));
export async function init(root) {
  root = await realpath(root);
  const file = await safePath(root, configFile, true);
  const fd = await open(file, 'wx', 0o600);
  try { await fd.writeFile(JSON.stringify({ version: 1, sources: [], skills: [] }, null, 2) + '\n'); } finally { await fd.close(); }
  return { status: 'initialized', next: 'List the authorized files in .jev-graphify.json and run update.' };
}
async function inventory(root) {
  const config = JSON.parse(await textFile(root, configFile, true, 32768));
  if (config.version !== 1 || !Array.isArray(config.sources) || !Array.isArray(config.skills) || config.sources.length + config.skills.length > 100 || [...config.sources, ...config.skills].some(f => typeof f !== 'string') || new Set([...config.sources, ...config.skills]).size !== config.sources.length + config.skills.length) throw Error('Invalid configuration: use version 1 and up to 100 unique paths.');
  const records = [];
  for (const [kind, paths] of [['reference', config.sources], ['skill', config.skills]]) for (const source of paths) {
    checkPath(source);
    if (!(codeExtension.test(source) || /\.(md|txt)$/i.test(source)) || (kind === 'skill' && !/\.md$/i.test(source))) throw Error('Unsupported file type: ' + source);
    const body = await textFile(root, source);
    const title = (body.match(/^#\s+(.+)$/m)?.[1] || source).slice(0, 100);
    const description = (body.match(/^description:\s*(.+)$/m)?.[1] || body.replace(/\s+/g, ' ')).slice(0, 400);
    records.push({ id: hash(kind + ':' + source), kind, title, description, source, version: hash(body), body });
  }
  if (records.reduce((n, r) => n + Buffer.byteLength(r.body), 0) > 2097152) throw Error('Fontes excedem 2 MB.');
  return { records, revision: hash(JSON.stringify(config) + JSON.stringify(records.map(r => [r.id, r.version]))) };
}
async function readIndex(root, required = true) {
  try {
    const data = JSON.parse(await textFile(root, indexFile, true, 12582912));
    if (data.schema !== 1 || data.project !== hash(await realpath(root)) || !Array.isArray(data.records) || !Array.isArray(data.graph?.nodes) || !Array.isArray(data.graph?.edges)) throw Error('Index is invalid or belongs to another project; generate it again.');
    return data;
  } catch (e) { if (e.code === 'ENOENT' && !required) return null; throw e; }
}
export async function status(root) {
  const inv = await inventory(root), index = await readIndex(root, false);
  const { projectStatus } = await import('./project.mjs');
  return { status: !index ? 'missing' : inv.revision !== index.revision ? 'stale' : JSON.stringify(inv.records) !== JSON.stringify(index.records) ? 'invalid' : 'current', revision: index?.revision ?? null, generatedAt: index?.generatedAt ?? null, sources: inv.records.length, graph: index ? { generator: index.graph.generator, version: index.graph.version, nodes: index.graph.nodes.length, edges: index.graph.edges.length } : null, project: await projectStatus(root) };
}
async function rebuild(root, inv, options) {
  // Sem fonte de código não há o que extrair: não chama o Graphify à toa (config só com `code`).
  const graph = inv.records.some(r => r.kind === 'reference' && codeExtension.test(r.source)) ? await generateGraph(root, inv.records, options) : { generator: 'graphifyy', version: '0.9.107', mode: 'code-only/no-cluster', directed: true, nodes: [], edges: [] };
  if ((await inventory(root)).revision !== inv.revision) throw Error('Sources changed during the update. Try again.');
  const index = { schema: 1, project: hash(root), revision: inv.revision, generatedAt: new Date().toISOString(), records: inv.records, graph };
  await atomicJson(root, indexFile, index);
  return { status: 'updated', revision: inv.revision, sources: inv.records.length, nodes: graph.nodes.length, edges: graph.edges.length };
}
// Índice de código (opcional): refeito só quando a impressão digital dos arquivos mudou.
async function updateProject(root, options) {
  const { codeConfig, walkCode, fingerprint, readProject, buildProject, refreshProject } = await import('./project.mjs');
  const code = await codeConfig(root);
  if (!code) return null;
  const old = await readProject(root), print = fingerprint((await walkCode(root, code)).files);
  if (old?.fingerprint === print && !options.full) return { status: 'unchanged', files: old.files.length, nucleos: old.nucleos.length };
  // Primeiro tenta só os arquivos alterados (segundos); refaz tudo quando não dá ou quando `full` foi pedido.
  const partial = old && !options.full ? await refreshProject(root, code, old, options) : null;
  const index = partial ? partial.index : await buildProject(root, code, options);
  await atomicJson(root, '.jev-graphify/project.json', index);
  return { status: 'updated', mode: partial ? 'incremental' : 'full', ...(partial ? { changed: partial.changed } : {}), files: index.files.length, nucleos: index.nucleos.length };
}
export async function update(root, options = {}) {
  root = await realpath(root);
  const folder = await safePath(root, '.jev-graphify', true); await mkdir(folder, { recursive: true });
  const lock = await safePath(root, '.jev-graphify/update.lock', true);
  const fd = await acquire(lock);
  try {
    const inv = await inventory(root), old = await readIndex(root, false);
    const result = old?.revision === inv.revision && JSON.stringify(old.records) === JSON.stringify(inv.records) ? { status: 'unchanged', revision: inv.revision } : await rebuild(root, inv, options);
    const project = await updateProject(root, options);
    return project ? { ...result, project } : result;
  } finally { await fd.close(); await unlink(lock).catch(() => {}); }
}
// Uma atualização dura no máximo ~60 s (limite do Graphify). Trava mais velha que lockMaxAge, ou de um
// processo desta máquina que já terminou, é resíduo de servidor encerrado no meio e pode ser assumida.
export const lockMaxAge = 180000;
async function acquire(lock) {
  for (let attempt = 0; ; attempt++) {
    let fd;
    try { fd = await open(lock, 'wx', 0o600); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const st = await stat(lock).catch(() => null);
      if (attempt || (st && Date.now() - st.mtimeMs <= lockMaxAge && await ownerAlive(lock))) throw Error('An update is already running. If none is running, the lock expires by itself in 3 minutes.');
      if (st) await unlink(lock).catch(() => {});
      continue;
    }
    try { await fd.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return fd; }
    catch (e) { await fd.close(); await unlink(lock).catch(() => {}); throw e; }
  }
}
// Sem PID legível (trava de versão antiga ou gravação incompleta), vale só a idade.
async function ownerAlive(lock) {
  try {
    const { pid } = JSON.parse(await readFile(lock, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) return true;
    try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
  } catch { return true; }
}
async function currentIndex(root) {
  const index = await readIndex(root);
  const inv = await inventory(root);
  if (inv.revision !== index.revision) throw Error('Memory is out of date. Run update before querying.');
  if (JSON.stringify(inv.records) !== JSON.stringify(index.records)) throw Error('Memory snapshots are invalid; generate the index again.');
  return index;
}
function ranked(index, query, kind) {
  const terms = tokens(query);
  const scores = new Map(index.records.filter(r => r.kind === kind).map(r => [r.source, terms.reduce((n, t) => n + (matches(tokens(r.title + ' ' + r.description), t) ? 4 : 0) + (matches(tokens(r.body), t) ? 1 : 0), 0)]));
  if (kind === 'reference') {
    const seeds = index.graph.nodes.filter(n => terms.some(t => matches(tokens(n.title), t))).slice(0, 6);
    const seen = new Set(seeds.map(n => n.id)); let frontier = new Set(seen);
    for (let depth = 0; depth < 2; depth++) {
      const next = new Set();
      for (const edge of index.graph.edges) {
        if (frontier.has(edge.source) && !seen.has(edge.target)) next.add(edge.target);
        if (!index.graph.directed && frontier.has(edge.target) && !seen.has(edge.source)) next.add(edge.source);
      }
      for (const id of next) seen.add(id); frontier = next;
    }
    // Bônus de grafo uma vez por arquivo, não por símbolo: arquivo com muitos nós não passa na frente só pelo tamanho.
    for (const source of new Set(index.graph.nodes.filter(n => seen.has(n.id)).map(n => n.source))) if (scores.has(source)) scores.set(source, scores.get(source) + 2);
  }
  return index.records.filter(r => r.kind === kind && scores.get(r.source) > 0).map(r => ({ ...r, score: scores.get(r.source) })).sort((a, b) => b.score - a.score || a.source.localeCompare(b.source)).slice(0, 12);
}
const metadata = ({ body, ...r }) => r;
const excerpt = row => ({ ...metadata(row), body: row.body.slice(0, 6000), truncated: row.body.length > 6000, trust: 'untrusted_project_data' });
function queryText(query) { if (typeof query !== 'string' || !query.trim() || query.length > 4000) throw Error('Invalid query (1–4000 characters).'); }
export async function search(root, query, kind = 'reference') {
  queryText(query); if (!['reference', 'skill'].includes(kind)) throw Error('Invalid kind.');
  const index = await currentIndex(root);
  return { revision: index.revision, candidates: ranked(index, query, kind).map(metadata), trust: 'untrusted_project_data' };
}
export async function read(root, id) {
  const index = await currentIndex(root), record = index.records.find(r => r.id === id);
  if (!record) throw Error('Reference does not belong to this project.');
  return { revision: index.revision, ...excerpt(record) };
}
// Teto diário atingido: a seleção sai como se o Jev estivesse desligado, mas com o motivo e o uso.
const capped = (selection, gate) => gate.daily ? { ...selection, reason: 'daily_limit', daily: gate.daily } : selection;
export async function route(root, task, options = {}) {
  queryText(task);
  const index = await currentIndex(root), result = { revision: index.revision }, gate = await jevGate(root, options);
  for (const kind of ['skill', 'reference']) {
    // Skills need semantic routing over the complete, small explicit catalog.
    const candidates = kind === 'skill' ? index.records.filter(r => r.kind === kind) : ranked(index, task, kind);
    if (candidates.length > 12) { result[kind] = { status: 'catalog_limit', ids: [], candidates: candidates.map(metadata), context: [] }; continue; }
    const selection = capped(await choose({ ...options, ...(gate.daily ? { jev: false } : {}), task, candidates: candidates.map(metadata), onSend: m => appendSendLog(root, { purpose: 'route', ...m }) }), gate);
    result[kind] = { ...selection, candidates: candidates.map(metadata), context: candidates.filter(c => selection.ids.includes(c.id)).map(excerpt) };
  }
  return result;
}
export async function recover(root, input, options = {}) {
  const { task, failure, diagnosis, loadedIds = [], round = 1 } = input;
  queryText(task);
  if (typeof failure !== 'string' || !failure.trim() || failure.length > 6000 || ![1, 2].includes(round) || !Array.isArray(loadedIds) || loadedIds.length > 4 || loadedIds.some(id => typeof id !== 'string') || !diagnosis || !['memory_gap', 'code_issue', 'inconclusive'].includes(diagnosis.kind) || typeof diagnosis.reason !== 'string' || !diagnosis.reason.trim() || diagnosis.reason.length > 600 || typeof diagnosis.evidence !== 'string' || diagnosis.evidence.length < 8 || !failure.includes(diagnosis.evidence) || !Array.isArray(diagnosis.queries) || diagnosis.queries.length > 3 || diagnosis.queries.some(q => typeof q !== 'string' || !q.trim() || q.length > 300)) throw Error('Invalid diagnosis: quote a real excerpt of the failure and give up to three queries. Limit of two rounds.');
  const index = await currentIndex(root);
  if (loadedIds.some(id => !index.records.some(r => r.id === id))) throw Error('Loaded context is outside the project.');
  if (diagnosis.kind === 'inconclusive') return { status: 'review_pending', diagnosis };
  let candidates = [], selection = { status: 'not_needed', ids: [] };
  if (diagnosis.kind === 'memory_gap') {
    if (!diagnosis.queries.length) throw Error('A query is needed to recover memory.');
    // Várias consultas: fica o melhor score de cada referência e a lista é reordenada antes do corte.
    const best = new Map();
    for (const r of diagnosis.queries.flatMap(q => ranked(index, q, 'reference'))) if (!loadedIds.includes(r.id) && !(best.get(r.id)?.score >= r.score)) best.set(r.id, r);
    candidates = [...best.values()].sort((a, b) => b.score - a.score || a.source.localeCompare(b.source)).slice(0, 6);
    const gate = await jevGate(root, options);
    selection = capped(await choose({ ...options, ...(gate.daily ? { jev: false } : {}), task: (task + '\n' + diagnosis.reason).slice(0, 4000), candidates: candidates.map(metadata), onSend: m => appendSendLog(root, { purpose: 'recover', ...m }) }), gate);
    if (selection.status !== 'selected') return { status: 'memory_pending', diagnosis, selection, candidates: candidates.map(metadata) };
  }
  const ids = [...new Set([...loadedIds, ...selection.ids])];
  const records = ids.map(id => index.records.find(r => r.id === id));
  if (records.reduce((n, r) => n + r.body.length, 0) > 12000) return { status: 'context_limit', diagnosis };
  return { status: 'ready_for_executor', revision: index.revision, diagnosis, addedIds: selection.ids, memories: records.map(excerpt), round, maxRounds: 2, next: 'Continue in the same executor and run the original tests. If the failure repeats, stop. This tool did not run any command.' };
}
