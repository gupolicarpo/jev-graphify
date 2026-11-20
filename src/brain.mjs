import { realpath, lstat, readdir, mkdir, open, writeFile } from 'node:fs/promises';
import { resolve, relative, basename, isAbsolute, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, safePath, textFile, atomicJson, checkPath } from './files.mjs';
import { codeExtension, defaultPython } from './graphify.mjs';
import { readProject, withStage, runPython } from './project.mjs';
import { scrub } from './jev.mjs';
const bridge = fileURLToPath(new URL('./graphify-brain.py', import.meta.url));
const configFile = '.jev-graphify.json', brainFile = '.jev-graphify/brain.json';
const MAX_NOTES = 10000, MAX_BYTES = 67108864, MAX_NOTE = 262144;
const bad = why => Error('Invalid configuration in brain: ' + why);
const shown = s => String(s).slice(0, 200);
const low = s => String(s).toLowerCase();
const collapse = s => String(s).replace(/\s+/g, ' ').trim();
const dirOf = k => k.includes('/') ? k.slice(0, k.lastIndexOf('/')) : '';
const byText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const VIA = ['frontmatter', 'link', 'mention', 'symbol'];
// Pasta relativa ao projeto: mesma validação de code.roots.
function checkFolder(r, what, dot = true) {
  if (typeof r !== 'string' || !r || r.length > 200) throw bad('each ' + what + ' must be text.');
  if (dot && r === '.') return;
  if (r.includes('\\') || r.includes(':') || isAbsolute(r) || r.split('/').some(p => !p || p === '..' || p === '.' || p.startsWith('.'))) throw bad('invalid ' + what + ' (use a relative folder with /, without ".." or hidden folders): ' + shown(r));
}
// Lê só a chave `brain` de .jev-graphify.json (mais `brainDirs` do integrador); devolve null quando não há Second Brain.
export async function brainConfig(root, options = {}) {
  root = await realpath(root);
  const dirs = Array.isArray(options.brainDirs) ? options.brainDirs : [];
  let config;
  try { config = JSON.parse(await textFile(root, configFile, true, 32768)); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const brain = config?.brain;
  if (brain !== undefined && (!brain || typeof brain !== 'object' || Array.isArray(brain))) throw bad('use an object with roots.');
  const { roots = [], exclude = [], private_tags: tags = ['private'], inbox } = brain ?? {};
  if (!Array.isArray(roots) || roots.length > 20) throw bad('roots must have up to 20 folders.');
  if (!roots.length && !dirs.length) return null;
  for (const r of roots) checkFolder(r, 'root');
  if (!Array.isArray(exclude) || exclude.length > 200 || exclude.some(e => typeof e !== 'string' || !e || e.length > 200)) throw bad('exclude must have at most 200 non-empty strings.');
  if (!Array.isArray(tags) || tags.length > 50 || tags.some(t => typeof t !== 'string' || !t.replace(/^#/, '') || t.length > 100)) throw bad('private_tags must have at most 50 non-empty strings.');
  if (inbox !== undefined && inbox !== null) checkFolder(inbox, 'inbox', false);
  const vaults = [], seen = new Set(), labels = new Set();
  const add = (dir, label) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    let name = label, n = 1;
    while (labels.has(low(name))) name = label + '-' + ++n;
    labels.add(low(name)); vaults.push({ dir, label: name });
  };
  for (const r of roots) {
    const dir = r === '.' ? root : await safePath(root, r), st = await lstat(dir).catch(() => null);
    if (!st?.isDirectory() || st.isSymbolicLink()) throw Error('Brain folder not found or invalid: ' + r);
    add(await realpath(dir), r === '.' ? basename(root) : r);
  }
  for (const d of dirs) {
    let real;
    try { if (typeof d !== 'string' || !isAbsolute(d)) throw Error(); real = await realpath(d); if (!(await lstat(real)).isDirectory()) throw Error(); }
    catch { throw Error('Invalid brain folder: ' + shown(d)); }
    add(real, basename(real) || 'vault');
  }
  return { vaults, exclude, privateTags: [...new Set(tags.map(t => low(t).replace(/^#/, '')))], inbox: inbox ?? null };
}
export async function walkBrain(config) {
  const exclude = config.exclude.map(e => low(e).replace(/^\/+|\/+$/g, '')).filter(Boolean);
  const excluded = rel => { const l = low(rel); return exclude.some(e => l.split('/').includes(e) || l === e || l.startsWith(e + '/')); };
  const files = [], skipped = []; let bytes = 0;
  const limit = () => Error('Second Brain over the limit (10000 notes or 64 MiB). Use brain.exclude to reduce it.');
  for (const v of config.vaults) {
    async function walk(dir, rel) {
      for (const name of (await readdir(dir)).sort()) {
        const path = resolve(dir, name), file = rel ? rel + '/' + name : name;
        const st = await lstat(path).catch(() => null);
        if (!st || st.isSymbolicLink() || name.startsWith('.') || excluded(file)) continue;
        if (st.isDirectory()) { if (low(name) !== 'node_modules') await walk(path, file); continue; }
        if (!st.isFile() || !/\.md$/i.test(name)) continue;
        if (st.size > MAX_NOTE) { skipped.push({ vault: v.label, rel: file, reason: 'larger than 256 KiB' }); continue; }
        bytes += st.size;
        if (files.length + 1 > MAX_NOTES || bytes > MAX_BYTES) throw limit();
        files.push({ vault: v.label, rel: file, size: st.size, mtimeMs: st.mtimeMs });
      }
    }
    await walk(v.dir, '');
  }
  const byKey = (a, b) => byText(a.vault + '/' + a.rel, b.vault + '/' + b.rel);
  return { files: files.sort(byKey), skipped: skipped.sort(byKey) };
}
// ---- Leitura de uma nota ----
const unq = s => String(s).trim().replace(/^(["'])(.*)\1$/, '$2');
function splitList(inner) {
  const out = []; let cur = '', quote = '';
  for (const ch of inner) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(unq).filter(Boolean);
}
// Frontmatter: escalares, aspas, blocos >/|, listas em linha [a, "b"] e listas em bloco (- a).
function splitFrontmatter(text) {
  text = String(text).replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trimEnd() !== '---') return { fields: {}, body: text };
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  if (end < 0) return { fields: {}, body: text };
  const fields = {};
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(lines[i]);
    if (!m) continue;
    let value = m[2].trim();
    if (/^[>|][+-]?$/.test(value)) {
      const parts = [];
      while (i + 1 < end && (/^\s/.test(lines[i + 1]) || !lines[i + 1].trim())) { const l = lines[++i].trim(); if (l) parts.push(l); }
      value = parts.join(' ');
    } else if (value === '') {
      const items = [];
      for (let j = i + 1; j < end; j++) {
        const li = /^\s*-\s+(.*)$/.exec(lines[j]);
        if (li) { items.push(unq(li[1])); i = j; } else if (lines[j].trim()) break; else i = j;
      }
      if (items.length) value = items;
    } else if (value.startsWith('[') && !value.startsWith('[[') && value.endsWith(']')) value = splitList(value.slice(1, -1));
    else value = unq(value);
    fields[m[1].toLowerCase()] = value;
  }
  return { fields, body: lines.slice(end + 1).join('\n') };
}
const asList = (v, sep = /,/) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : typeof v === 'string' && v ? v.split(sep).map(x => x.trim()).filter(Boolean) : [];
const first = (f, ...keys) => { for (const k of keys) { const v = f[k]; if (typeof v === 'string' && v.trim()) return v.trim(); } return ''; };
const linkTarget = raw => String(raw).replace(/^!?\[\[|\]\]$/g, '').split('|')[0].split('#')[0].trim();
const wikiRe = /!?\[\[([^\[\]\n]+?)\]\]/g;
const mdRe = /(!?)\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const mediaRe = /\.(?:png|jpe?g|gif|svg|webp|bmp|pdf|mp[34]|wav|webm|mov|canvas|base)$/i;
const extAlt = codeExtension.source.replace(/\$$/, '');
const mentionRe = new RegExp('(?<![\\w./@\\\\-])((?:[\\w@.-]+/)*[\\w@-]+' + extAlt + ')(?![\\w-])', 'gi');
const pathSpan = new RegExp('^[\\w@./-]+' + extAlt + '(?::\\d+)?$', 'i');
const identSpan = /^[A-Za-z_$][\w$]*(?:(?:\.|::|->|#)[A-Za-z_$][\w$]*)*(?:\(.*\))?$/;
const nameKey = s => low(String(s).trim()).replace(/\.md$/, '');
const refersTo = (target, names) => { const t = nameKey(target); return names.has(t) || names.has(t.split('/').pop()); };
// Nomes de notas privadas somem dos textos das outras: o link vira "[private note]" e deixa de existir.
function redact(text, names) {
  return text.replace(wikiRe, (m, t) => refersTo(linkTarget(t), names) ? '[private note]' : m)
    .replace(mdRe, (m, img, a, b) => { let h = a ?? b; try { h = decodeURIComponent(h); } catch {} return !img && /\.md(?:[#?].*)?$/i.test(h) && refersTo(h.split(/[#?]/)[0], names) ? '[private note]' : m; });
}
export function parseNote(text, { rel = '', privateTags = ['private'], privateNames } = {}) {
  if (privateNames?.size) text = redact(String(text), privateNames);
  const { fields, body } = splitFrontmatter(text);
  const headings = []; let h1 = '', fenced = false;
  const proseLines = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { const t = h[2].replace(/\s+#+\s*$/, '').trim(); if (h[1].length === 1) h1 ||= t; else if (h[1].length <= 4 && headings.length < 12 && t) headings.push(t); }
    proseLines.push(line);
  }
  const prose = proseLines.join('\n'), links = [], paths = new Map(), symbols = new Set();
  const addPath = (p, via) => { p = String(p).trim().replace(/^`|`$/g, '').replace(/:\d+(?:-\d+)?$/, ''); if (p && (!paths.has(p) || VIA.indexOf(via) < VIA.indexOf(paths.get(p)))) paths.set(p, via); };
  for (const m of prose.matchAll(wikiRe)) {
    const t = linkTarget(m[1]);
    if (!t) continue;
    if (codeExtension.test(t)) addPath(t, 'link'); else if (!mediaRe.test(t)) links.push(t.replace(/\.md$/i, ''));
  }
  const dir = dirOf(rel.replace(/\\/g, '/'));
  for (const m of prose.matchAll(mdRe)) {
    if (m[1]) continue;
    let href = m[2] ?? m[3];
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) continue;
    href = href.split(/[#?]/)[0];
    try { href = decodeURIComponent(href); } catch {}
    if (!href) continue;
    if (codeExtension.test(href)) addPath(href, 'link');
    else if (/\.md$/i.test(href)) { const t = posix.normalize(posix.join(dir || '.', href)).replace(/^(?:\.\.\/)+/, '').replace(/^\/+/, '').replace(/\.md$/i, ''); if (t && t !== '..') links.push(t); }
  }
  const supersededBy = asList(fields.superseded_by).map(linkTarget).filter(Boolean), supersedes = asList(fields.supersedes).map(linkTarget).filter(Boolean);
  const hidden = t => privateNames?.size && refersTo(t, privateNames);
  const supBy = supersededBy.filter(t => !hidden(t)), sup = supersedes.filter(t => !hidden(t));
  links.push(...supBy, ...sup);
  for (const p of [...asList(fields.code), ...asList(fields.files)]) addPath(p, 'frontmatter');
  // Texto sem a sintaxe dos links: dele saem os caminhos citados no texto e as etiquetas.
  const rest = prose.replace(wikiRe, ' ').replace(mdRe, ' ');
  for (const m of rest.matchAll(mentionRe)) addPath(m[1], 'mention');
  for (const m of rest.matchAll(/`([^`\n]+)`/g)) {
    const s = m[1].trim();
    if (pathSpan.test(s) || !identSpan.test(s)) continue;
    for (const part of s.replace(/\(.*\)$/, '').split(/\.|::|->|#/)) if (part.length >= 3 && symbols.size < 40) symbols.add(part);
  }
  const tags = new Set([...asList(fields.tags, /[,\s]+/), ...asList(fields.tag, /[,\s]+/)].map(t => low(t).replace(/^#/, '')).filter(Boolean));
  for (const line of rest.replace(/`[^`\n]*`/g, ' ').split('\n')) {
    if (/^\s*#{1,6}\s/.test(line)) continue;
    for (const m of line.matchAll(/(?:^|[^\w#&/\\])#([\p{L}\p{N}_/-]+)/gu)) { const t = low(m[1]).replace(/[-/]+$/, ''); if (t && !/^\d+$/.test(t)) tags.add(t); }
  }
  const lead = collapse(proseLines.filter(l => !/^\s*#{1,6}\s/.test(l)).join(' ').replace(wikiRe, (m, t) => m.slice(m.startsWith('!') ? 3 : 2, -2).split('|').pop().split('#')[0]).replace(mdRe, (m, img, a, b) => m.slice(m.indexOf('[') + 1, m.indexOf(']'))));
  const priv = /^(?:true|yes|on)$/i.test(String(fields.private ?? '')) || [...tags].some(t => privateTags.some(p => t === p || t.startsWith(p + '/')));
  const name = rel.split('/').pop().replace(/\.md$/i, '');
  return {
    title: collapse(first(fields, 'title') || h1 || name).slice(0, 200), aliases: [...new Set([...asList(fields.aliases), ...asList(fields.alias)].map(collapse))].slice(0, 20), tags: [...tags],
    type: first(fields, 'type').slice(0, 40), status: first(fields, 'status').slice(0, 40), date: first(fields, 'date', 'created').slice(0, 40),
    description: collapse(first(fields, 'description', 'summary') || lead).slice(0, 160), headings, links, supersededBy: supBy, supersedes: sup,
    codeMentions: { paths: [...paths].map(([path, via]) => ({ path, via })), symbols: [...symbols] }, private: priv, body,
  };
}
// ---- Links entre notas (regras do Obsidian) ----
export function resolveLinks(notes) {
  const byBase = new Map(), byAlias = new Map(), paths = [];
  const put = (m, k, i) => { if (!m.has(k)) m.set(k, []); m.get(k).push(i); };
  notes.forEach((n, i) => {
    if (n.private) return;
    const p = low(n.key).replace(/\.md$/, '');
    put(byBase, p.split('/').pop(), i); paths.push([p, i]);
    for (const a of n.aliases ?? []) put(byAlias, low(a.trim()), i);
  });
  // Mesma pasta da nota de origem primeiro, depois o caminho mais curto, depois ordem alfabética.
  const pick = (list, from) => [...new Set(list)].sort((a, b) => (dirOf(notes[b].key) === dirOf(notes[from].key)) - (dirOf(notes[a].key) === dirOf(notes[from].key)) || notes[a].key.length - notes[b].key.length || byText(notes[a].key, notes[b].key))[0];
  const find = (raw, from) => {
    const t = nameKey(raw).replace(/^\/+/, '');
    if (!t) return -1;
    const list = t.includes('/') ? paths.filter(([p]) => p === t || p.endsWith('/' + t)).map(x => x[1]) : byBase.get(t) ?? byAlias.get(t) ?? [];
    return list.length ? pick(list, from) : -1;
  };
  const res = notes.map(() => ({ out: new Set(), in: new Set(), unresolved: 0, superseded: new Set(), supersedes: new Set() }));
  notes.forEach((n, i) => {
    if (n.private) return;
    for (const l of n.links ?? []) { const j = find(l, i); if (j < 0) res[i].unresolved++; else if (j !== i) { res[i].out.add(j); res[j].in.add(i); } }
    for (const l of n.supersededBy ?? []) { const j = find(l, i); if (j >= 0 && j !== i) res[i].superseded.add(j); }
    for (const l of n.supersedes ?? []) { const j = find(l, i); if (j >= 0 && j !== i) res[i].supersedes.add(j); }
  });
  const sorted = s => [...s].sort((a, b) => a - b);
  return res.map(r => ({ out: sorted(r.out), in: sorted(r.in), unresolved: r.unresolved, superseded: sorted(r.superseded), supersedes: sorted(r.supersedes) }));
}
// ---- Notas -> arquivos de código do índice do projeto ----
export function linkCode(notes, index) {
  if (!index) return notes.map(() => []);
  const files = index.files.map(f => f.file), has = new Set(files), lowFiles = files.map(f => [low(f), f]);
  const byBase = new Map(), exact = new Map(), loose = new Map();
  const put = (m, k, f) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(f); };
  for (const f of index.files) {
    put(byBase, low(f.file.split('/').pop()), f.file);
    for (const s of f.simbolos ?? []) for (const k of new Set([s, s.replace(/\(\)$/, '').replace(/^\./, '')])) { put(exact, k, f.file); put(loose, low(k), f.file); }
  }
  const words = s => new Set(low(s).match(/[a-z0-9]{3,}/g) ?? []);
  const resolveRef = (raw, note) => {
    const p = String(raw).replace(/\\/g, '/').replace(/^(?:\.{1,2}\/)+/, '').replace(/^\/+/, '');
    if (has.has(p)) return [p];
    const lp = low(p);
    const list = lp.includes('/') ? lowFiles.filter(([l]) => l === lp || l.endsWith('/' + lp)).map(x => x[1]) : [...byBase.get(lp) ?? []];
    if (list.length === 1) return list;
    if (list.length < 2 || list.length > 3) return [];
    const mine = words(dirOf(note.key) + ' ' + note.title), near = list.filter(f => [...words(dirOf(f))].some(w => mine.has(w)));
    return near.length === 1 ? near : [];
  };
  return notes.map(n => {
    if (n.private) return [];
    const found = new Map();
    const add = (file, via) => { if (!found.has(file) || VIA.indexOf(via) < VIA.indexOf(found.get(file))) found.set(file, via); };
    for (const { path, via } of n.codeMentions?.paths ?? []) for (const f of resolveRef(path, n)) add(f, via);
    for (const s of n.codeMentions?.symbols ?? []) { const list = [...exact.get(s) ?? loose.get(low(s)) ?? []]; if (list.length && list.length <= 3) for (const f of list) add(f, 'symbol'); }
    return [...found].map(([file, via]) => ({ file, via })).sort((a, b) => VIA.indexOf(a.via) - VIA.indexOf(b.via) || byText(a.file, b.file)).slice(0, 12);
  });
}
// Lê e interpreta todas as notas; as privadas só são contadas (os nomes delas servem para apagar os links nas outras).
export async function readNotes(config, walked) {
  const dirs = new Map(config.vaults.map(v => [v.label, v.dir])), skipped = [...walked.skipped], entries = [], names = new Set();
  let priv = 0;
  for (const f of walked.files) {
    let text;
    try { text = await textFile(dirs.get(f.vault), f.rel, true, MAX_NOTE); }
    catch (e) { skipped.push({ vault: f.vault, rel: f.rel, reason: String(e.message).slice(0, 100) }); continue; }
    const n = parseNote(text, { rel: f.rel, privateTags: config.privateTags });
    if (n.private) {
      priv++;
      for (const x of [n.title, ...n.aliases, f.rel.split('/').pop(), f.rel]) names.add(nameKey(x));
      for (const x of [...names]) names.add(x.split('/').pop());
    } else entries.push({ f, text, n });
  }
  // Um nome que também pertence a uma nota pública não é apagado: o link seguiria legítimo.
  for (const { f, n } of entries) for (const x of [n.title, ...n.aliases, f.rel.split('/').pop().replace(/\.md$/i, '')]) names.delete(nameKey(x));
  const notes = entries.map(({ f, text, n }) => {
    const p = names.size ? parseNote(text, { rel: f.rel, privateTags: config.privateTags, privateNames: names }) : n;
    return { key: f.vault + '/' + f.rel, source: 'brain/' + f.vault + '/' + f.rel, vault: f.vault, rel: f.rel, path: resolve(dirs.get(f.vault), f.rel), size: f.size, mtimeMs: f.mtimeMs, ...p };
  });
  return { notes, private: priv, skipped };
}
export const brainPrint = (config, files, project) => hash(JSON.stringify([config.vaults.map(v => v.label), config.exclude, config.privateTags]) + '\n' + files.map(f => f.vault + '/' + f.rel + ':' + f.size + ':' + Math.round(f.mtimeMs)).join('\n') + '\n' + (project?.fingerprint ?? ''));
async function readProjectSafe(root) { try { return await readProject(root); } catch { return null; } }
// Agrupa por pasta de topo quando o Graphify não está disponível.
function folderGroups(notes) {
  const names = [...new Set(notes.map(n => n.vault + '/' + (n.rel.includes('/') ? n.rel.split('/')[0] : '')))].sort();
  return new Map(notes.map(n => [n.key, names.indexOf(n.vault + '/' + (n.rel.includes('/') ? n.rel.split('/')[0] : ''))]));
}
async function clusterGraph(root, graph, python) {
  return withStage(root, 'brain-stage-', async stage => {
    await writeFile(resolve(stage, 'brain-graph.json'), JSON.stringify(graph));
    await runPython(stage, python, bridge, { timeout: 300000, label: '5 min', maxBuffer: 1048576 });
    const out = JSON.parse(await textFile(stage, 'brain-communities.json', true, 67108864));
    if (!out || typeof out.communities !== 'object' || Array.isArray(out.communities)) throw Error('Invalid Graphify communities.');
    return out;
  });
}
const top = (counts, n) => [...counts].sort((a, b) => b[1] - a[1] || byText(String(a[0]), String(b[0]))).slice(0, n).map(x => x[0]);
const tally = list => { const m = new Map(); for (const x of list) m.set(x, (m.get(x) ?? 0) + 1); return m; };
export async function buildBrain(root, config, walked, project, { python = defaultPython() } = {}) {
  const { notes, private: priv, skipped } = await readNotes(config, walked);
  const res = resolveLinks(notes), code = linkCode(notes, project);
  // Grafo único: notas, pastas, arquivos de código ligados e núcleos de código.
  const nodes = new Set(), edges = [], pair = new Set();
  const nucleoOf = new Map((project?.files ?? []).map(f => [f.file, f.nucleo]));
  notes.forEach((n, i) => {
    const id = 'n:' + n.key, hub = 'd:' + n.vault + '/' + dirOf(n.rel);
    nodes.add(id); nodes.add(hub); edges.push([id, hub, 0.3]);
    for (const j of res[i].out) {
      const k = Math.min(i, j) + ':' + Math.max(i, j);
      if (pair.has(k)) continue;
      pair.add(k);
      const strong = res[j].out.includes(i) || res[i].superseded.includes(j) || res[j].superseded.includes(i) || res[i].supersedes.includes(j) || res[j].supersedes.includes(i);
      edges.push([id, 'n:' + notes[j].key, strong ? 2 : 1]);
    }
    for (const c of code[i]) {
      nodes.add('c:' + c.file); edges.push([id, 'c:' + c.file, 1]);
      const k = nucleoOf.get(c.file);
      if (Number.isInteger(k) && k >= 0 && !pair.has('k' + c.file)) { pair.add('k' + c.file); nodes.add('k:' + k); edges.push(['c:' + c.file, 'k:' + k, 0.5]); }
    }
  });
  let clustering = 'graphify', fallback, graphify = null, group = new Map();
  try {
    const out = await clusterGraph(root, { nodes: [...nodes], edges }, python);
    for (const [id, members] of Object.entries(out.communities)) for (const m of members) if (typeof m === 'string' && m.startsWith('n:')) group.set(m.slice(2), Number(id));
    graphify = { version: String(out.graphify ?? ''), communities: new Set(group.values()).size };
  } catch (e) {
    clustering = 'folders'; fallback = String(e.message).slice(0, 300); group = folderGroups(notes);
  }
  const nucleo = notes.map(n => group.has(n.key) && Number.isInteger(group.get(n.key)) ? group.get(n.key) : -1);
  const ids = [...new Set(nucleo)].sort((a, b) => a - b), nucleos = ids.map(id => {
    const idx = notes.map((_, i) => i).filter(i => nucleo[i] === id);
    const degree = i => res[i].out.length + res[i].in.length;
    return {
      id, notes: idx.length, folders: top(tally(idx.map(i => notes[i].vault + '/' + dirOf(notes[i].rel)).map(f => f.replace(/\/$/, ''))), 6),
      tags: top(tally(idx.flatMap(i => notes[i].tags)), 10), titles: [...idx].sort((a, b) => degree(b) - degree(a) || byText(notes[a].title, notes[b].title)).slice(0, 25).map(i => notes[i].title),
      code: top(tally(idx.flatMap(i => code[i].map(c => c.file))), 8),
    };
  }).sort((a, b) => b.notes - a.notes || a.id - b.id);
  const index = {
    schema: 1, project: hash(root), generatedAt: new Date().toISOString(), fingerprint: brainPrint(config, walked.files, project), clustering, graphify,
    vaults: config.vaults.map(v => v.label), private: priv, skipped: skipped.length,
    notes: notes.map((n, i) => ({ key: n.key, title: n.title, nucleo: nucleo[i], code: code[i], stamp: n.size + ':' + Math.round(n.mtimeMs) })), nucleos,
  };
  return { index, fallback };
}
export async function readBrain(root) {
  root = await realpath(root);
  let data;
  try { data = JSON.parse(await textFile(root, brainFile, true, 33554432)); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  if (data?.schema !== 1 || data.project !== hash(root) || !Array.isArray(data.notes) || !Array.isArray(data.nucleos)) throw Error('Second Brain index is invalid or belongs to another project; run update again.');
  return data;
}
// Chamado por core.update: refaz o índice só quando a impressão digital das notas (ou a do índice de código) mudou.
export async function updateBrain(root, options = {}) {
  root = await realpath(root);
  const config = await brainConfig(root, options);
  if (!config) return null;
  const walked = await walkBrain(config), project = await readProjectSafe(root), old = await readBrain(root).catch(() => null);
  if (old && old.clustering === 'graphify' && old.fingerprint === brainPrint(config, walked.files, project) && !options.full) return { status: 'unchanged', notes: old.notes.length, nucleos: old.nucleos.length, clustering: old.clustering, private: old.private ?? 0, skipped: old.skipped ?? 0 };
  const { index, fallback } = await buildBrain(root, config, walked, project, options);
  await atomicJson(root, brainFile, index);
  return { status: 'updated', notes: index.notes.length, nucleos: index.nucleos.length, clustering: index.clustering, private: index.private, skipped: index.skipped, ...(fallback ? { fallback } : {}) };
}
export async function brainStatus(root, options = {}) {
  root = await realpath(root);
  const config = await brainConfig(root, options);
  if (!config) return { status: 'not_configured', notes: 0, nucleos: 0, generatedAt: null };
  const index = await readBrain(root).catch(() => null);
  if (!index) return { status: 'missing', notes: 0, nucleos: 0, generatedAt: null };
  const stale = index.fingerprint !== brainPrint(config, (await walkBrain(config)).files, await readProjectSafe(root));
  return { status: stale ? 'stale' : 'current', notes: index.notes.length, nucleos: index.nucleos.length, generatedAt: index.generatedAt };
}
// ---- Uso na consulta (recall): notas lidas na hora, núcleo vindo do brain.json ----
export async function openBrain(root, options = {}) {
  const config = await brainConfig(root, options);
  if (!config) return null;
  const { notes, private: priv, skipped } = await readNotes(config, await walkBrain(config));
  const project = await readProjectSafe(root), index = await readBrain(root).catch(() => null);
  const links = resolveLinks(notes), code = linkCode(notes, project);
  const known = new Map((index?.notes ?? []).map(n => [n.key, n.nucleo])), nucleo = notes.map(n => known.has(n.key) ? known.get(n.key) : null);
  const majority = votes => { const c = tally(votes.filter(v => v !== null && v >= 0)); return c.size ? [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : null; };
  // Nota fora do índice: comunidade da maioria das notas ligadas, senão da pasta, senão -1.
  const fresh = nucleo.map((v, i) => v ?? majority([...links[i].out, ...links[i].in].map(j => nucleo[j])) ?? majority(notes.map((m, j) => m.vault === notes[i].vault && dirOf(m.rel) === dirOf(notes[i].rel) ? nucleo[j] : null)) ?? -1);
  return { config, notes, links, code, nucleo: fresh, private: priv, skipped, files: new Map((project?.files ?? []).map(f => [f.file, f])), bySource: new Map(notes.map((n, i) => [n.source, i])) };
}
const joinNames = (brain, list) => list.map(j => brain.notes[j].title);
const suffix = (brain, i) => {
  const sup = joinNames(brain, brain.links[i].superseded), n = brain.notes[i], raw = sup.length ? sup : n.supersededBy;
  return raw.length ? ' (superseded by ' + raw.map(t => '[[' + t + ']]').join(', ') + ')' : '';
};
// Ficha da nota para a etapa de fichas: só metadados e títulos de notas públicas.
export function noteCard(brain, i) {
  const n = brain.notes[i], l = brain.links[i], titles = [...new Set(joinNames(brain, [...l.out, ...l.in]))].slice(0, 6), code = brain.code[i].slice(0, 4).map(c => c.file);
  const parts = [n.title + (n.aliases.length ? ' (aka ' + n.aliases.join(', ') + ')' : '') + ' — ' + n.description];
  if (n.type) parts.push('type: ' + n.type);
  if (n.status || suffix(brain, i)) parts.push('status: ' + (n.status || 'superseded') + suffix(brain, i));
  if (n.tags.length) parts.push('tags: ' + n.tags.slice(0, 10).join(', '));
  if (n.headings.length) parts.push('Sections: ' + n.headings.join('; '));
  if (titles.length) parts.push('Links: ' + titles.join('; '));
  if (code.length) parts.push('Code: ' + code.join(', '));
  return parts.join(' | ').slice(0, 900);
}
// Ficha de uma comunidade (etapa de núcleos).
export function communityCard(brain, ids) {
  const tags = top(tally(ids.flatMap(i => brain.notes[i].tags)), 8), folders = top(tally(ids.map(i => dirOf(brain.notes[i].key))), 5);
  const titles = [...ids].sort((a, b) => brain.links[b].out.length + brain.links[b].in.length - brain.links[a].out.length - brain.links[a].in.length || byText(brain.notes[a].title, brain.notes[b].title)).slice(0, 12).map(i => brain.notes[i].title);
  const code = top(tally(ids.flatMap(i => brain.code[i].map(c => c.file))), 8);
  return ('Notes: ' + ids.length + ' | Folders: ' + folders.join(', ') + ' | Tags: ' + tags.join(', ') + ' | Titles: ' + titles.join('; ') + (code.length ? ' | Code: ' + code.join(', ') : '')).slice(0, 900);
}
// Arquivos de código de uma nota: ligações diretas primeiro, depois as das notas vizinhas (2 saltos).
export function codeOf(brain, root, i, max = 4) {
  const seen = new Set(), out = [];
  const add = (c, via) => { if (seen.has(c.file) || out.length >= max) return; seen.add(c.file); out.push({ file: c.file, path: resolve(root, c.file), via, symbols: (brain.files.get(c.file)?.simbolos ?? []).slice(0, 8) }); };
  for (const c of brain.code[i]) add(c, c.via);
  for (const j of [...brain.links[i].out, ...brain.links[i].in]) for (const c of brain.code[j]) add(c, 'note:' + brain.notes[j].title);
  return out;
}
// Acrescenta ao resultado o que só existe com o Second Brain: código, links, vizinhos e substituições.
export function brainExtras(brain, root, out, known, pointers, codeMax = 4) {
  const returned = [], done = new Set(), codeUnion = new Map();
  for (const o of out) if (o.kind === 'note' && brain.bySource.has(o.source) && !returned.includes(brain.bySource.get(o.source))) returned.push(brain.bySource.get(o.source));
  const have = new Set(returned);
  for (const o of out) {
    const i = o.kind === 'note' ? brain.bySource.get(o.source) : undefined;
    if (i === undefined || done.has(i)) continue;
    done.add(i);
    const n = brain.notes[i], code = codeOf(brain, root, i, codeMax), l = brain.links[i];
    if (code.length) o.code = code;
    for (const c of code) if (!codeUnion.has(c.file)) codeUnion.set(c.file, { file: c.file, path: c.path, via: c.via });
    const links = [...new Set([...l.out, ...l.in].filter(j => !have.has(j)).map(j => brain.notes[j].title))].slice(0, 5);
    if (links.length) o.links = links;
    if (n.status) o.status = n.status;
    const sup = joinNames(brain, l.superseded), raw = sup.length ? sup : n.supersededBy;
    if (raw.length) o.superseded_by = raw.length === 1 ? raw[0] : raw;
  }
  const ptr = j => ({ kind: 'note', source: brain.notes[j].source, title: brain.notes[j].title });
  const supers = [...new Set(returned.flatMap(i => brain.links[i].superseded))].filter(j => !have.has(j)).map(j => ({ ...ptr(j), reason: 'supersedes' }));
  const touch = new Map();
  for (const i of returned) for (const j of new Set([...brain.links[i].out, ...brain.links[i].in])) if (!have.has(j)) touch.set(j, (touch.get(j) ?? 0) + 1);
  const near = [...touch].map(([j, c]) => ({ j, s: c + (known.get(brain.notes[j].source) ?? 0) })).sort((a, b) => b.s - a.s || byText(brain.notes[a.j].title, brain.notes[b.j].title)).map(x => ({ ...ptr(x.j), reason: 'linked' }));
  const related = [], seen = new Set();
  for (const r of [...supers, ...pointers, ...near]) { const k = r.kind + '\0' + r.source; if (!seen.has(k) && related.length < 5) { seen.add(k); related.push(r); } }
  return { code: [...codeUnion.values()].slice(0, 8), related };
}
// ---- note_capture: devolve notas ao inbox, sem nunca editar o que já existe ----
export async function hasInbox(root, options = {}) {
  try { return Boolean((await brainConfig(root, options))?.inbox); } catch { return false; }
}
const slugOf = s => low(s).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'note';
const strings = (v, max, len, what) => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string' || !x.trim() || x.length > len)) throw Error('Invalid ' + what + ': up to ' + max + ' texts of at most ' + len + ' characters.');
  return v.map(x => x.trim());
};
export async function captureNote(root, input, options = {}) {
  root = await realpath(root);
  const config = await brainConfig(root, options);
  if (!config?.inbox) throw Error('No inbox configured. Set brain.inbox in .jev-graphify.json.');
  if (!input || typeof input !== 'object' || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120 || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 8000) throw Error('Invalid note: title 1–120 and body 1–8000 characters.');
  const tags = strings(input.tags, 8, 40, 'tags').map(t => t.replace(/^#/, '').replace(/\s+/g, '-')), links = strings(input.links, 10, 200, 'links').map(l => collapse(l.replace(/[\[\]|#^]/g, ''))).filter(Boolean), code = strings(input.code, 10, 300, 'code paths');
  for (const c of code) checkPath(c, true);
  const clean = scrub({ title: collapse(input.title), body: input.body.trim(), tags, links, code }).value;
  const vault = config.vaults[0], dir = await safePath(vault.dir, config.inbox, true);
  await mkdir(dir, { recursive: true });
  const real = await realpath(dir), rel = relative(vault.dir, real);
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !(await lstat(real)).isDirectory()) throw Error('Inbox path is outside the vault.');
  const now = new Date().toISOString(), stem = now.slice(0, 10) + ' ' + slugOf(clean.title);
  const text = '---\ntitle: ' + JSON.stringify(clean.title) + '\ntype: agent-note\ncreated: ' + now + '\nsource: agent\n' + (clean.tags.length ? 'tags: ' + JSON.stringify(clean.tags) + '\n' : '') + (clean.code.length ? 'code: ' + JSON.stringify(clean.code) + '\n' : '') + '---\n\n' + clean.body + (clean.links.length ? '\n\nRelated: ' + clean.links.map(l => '[[' + l + ']]').join(', ') : '') + '\n';
  for (let n = 1; n <= 200; n++) {
    const name = stem + (n > 1 ? ' ' + n : '') + '.md';
    let fd;
    try { fd = await open(resolve(real, name), 'wx'); }
    catch (e) { if (e.code === 'EEXIST') continue; throw e; }
    try { await fd.writeFile(text); } finally { await fd.close(); }
    return { status: 'saved', source: 'brain/' + vault.label + '/' + rel.replace(/\\/g, '/') + '/' + name, path: resolve(real, name) };
  }
  throw Error('Too many notes with the same title today.');
}
