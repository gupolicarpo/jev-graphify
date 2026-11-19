import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir, symlink, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fixture, cleanup } from './helpers.mjs';
import { hash, atomicJson } from '../src/files.mjs';
import * as core from '../src/core.mjs';
import { recall } from '../src/memory.mjs';
import { walkCode, fingerprint, findInProject } from '../src/project.mjs';
import { brainConfig, walkBrain, parseNote, resolveLinks, linkCode, captureNote, hasInbox } from '../src/brain.mjs';
const key = 'fictional-test-credential';
const reply = (answers, status = 200) => new Response(JSON.stringify({ answers, usage: { input_tokens: 7 } }), { status, headers: { 'content-type': 'application/json' } });
// Responde pela primeira marca (ALTO, MEDIO, BAIXO) achada nas instruções; sem marca, 0.05. Guarda tudo o que foi enviado.
function scripted({ calls = [], values = { ALTO: 0.9, MEDIO: 0.7, BAIXO: 0.01 } } = {}) {
  const request = async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const answers = {};
    for (const [k, q] of Object.entries(body.questions)) answers[k] = { type: 'noul', noul: Object.entries(values).find(([m]) => q.instructions.includes(m))?.[1] ?? 0.05 };
    return reply(answers);
  };
  return { request, calls };
}
const instructions = calls => calls.flatMap(b => Object.values(b.questions).map(q => q.instructions));
const write = async (root, file, text) => { await mkdir(resolve(root, file, '..'), { recursive: true }); await writeFile(resolve(root, file), text); };
// Raiz de teste com cofre em notes/. Sem fonte de código para não chamar o Graphify na atualização.
async function vault(t, notes, brain = { roots: ['notes'] }) {
  const { root } = await fixture(t);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: ['policy.md'], skills: ['skill.md'], brain }));
  for (const [rel, text] of Object.entries(notes)) await write(root, 'notes/' + rel, text);
  return root;
}
// Índice de código feito à mão, marcado como atual.
async function codeIndex(root, files) {
  const config = JSON.parse(await readFile(resolve(root, '.jev-graphify.json'), 'utf8'));
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, code: { roots: ['src'] } }));
  for (const f of Object.keys(files)) await write(root, f, 'def f():\n    return 1\n');
  const { files: walked } = await walkCode(root, { roots: ['src'] });
  const list = Object.entries(files).map(([file, simbolos]) => ({ file, nucleo: 0, simbolos, stamp: '1:1' })).sort((a, b) => a.file < b.file ? -1 : 1);
  const index = { schema: 1, project: hash(await realpath(root)), generatedAt: '2026-01-01T00:00:00Z', fingerprint: fingerprint(walked), graphify: { version: '0.9.107', nodes: 1, edges: 0, communities: 1 }, files: list, nucleos: [{ id: 0, rotulos: [], pastas: ['src'], arquivos: list.map(f => f.file) }] };
  await atomicJson(root, '.jev-graphify/project.json', index);
  return index;
}
const bogus = root => ({ python: resolve(root, 'missing-python') });
const opts = (extra = {}) => ({ autoMemory: false, privacy: 'completo', ...extra });
const SECRET = 'ZEBRA-SECRET-4711', INLINE = 'QUOKKA-INLINE-9';
const notes = {
  'Billing/Invoice Rounding.md': '---\naliases: [Rounding]\ntags: [billing]\ncode: [src/billing/calc.py]\n---\n# Invoice Rounding\nALTO: round invoice totals with `round_invoice`. See [[Tax Policy]], [[Salary Plan Quartz]] and [[Rounding v1]].\n',
  'Billing/Tax Policy.md': '# Tax Policy\nBAIXO: tax rules per country. Back to [[Invoice Rounding]].\n',
  'Decisions/Rounding v1.md': '---\nstatus: superseded\nsuperseded_by: "[[Rounding v2]]"\n---\n# Rounding v1\nALTO: first rounding decision, round half up.\n',
  'Decisions/Rounding v2.md': '# Rounding v2\nBAIXO: second rounding decision, banker rounding.\n',
  'Private/Salary Plan Quartz.md': '---\nprivate: true\n---\n# Salary Plan Quartz\nALTO ' + SECRET + ' salary of everyone, see `src/billing/calc.py`.\n',
  'Journal/Mood.md': '# Mood\nALTO ' + INLINE + ' feeling bad #private\n',
  'Daily/2026-01-01.md': '# Daily\nBAIXO: nothing linked here.\n',
  'Templates/Template.md': '# Template\nALTO template.\n',
};
test('parseNote: frontmatter com escalares, aspas, blocos e listas', () => {
  const n = parseNote('---\ntitle: "My Note"\naliases: [Foo, "Bar, Baz"]\ntags:\n  - a\n  - "#B"\ntype: decision\nstatus: >\n  superseded\n  really\ncode: [src/a.py, \'src/b.py\']\nprivate: false\nsuperseded_by: "[[New]]"\nsupersedes: [[Old]]\ncreated: 2026-01-02\ndescription: Short summary\n---\n# Heading\nbody', { rel: 'x/My Note.md' });
  assert.equal(n.title, 'My Note'); assert.deepEqual(n.aliases, ['Foo', 'Bar, Baz']); assert.deepEqual(n.tags, ['a', 'b']);
  assert.equal(n.type, 'decision'); assert.equal(n.status, 'superseded really'); assert.equal(n.description, 'Short summary'); assert.equal(n.date, '2026-01-02');
  assert.deepEqual(n.supersededBy, ['New']); assert.deepEqual(n.supersedes, ['Old']); assert.ok(n.links.includes('New') && n.links.includes('Old'));
  assert.deepEqual(n.codeMentions.paths.filter(p => p.via === 'frontmatter').map(p => p.path), ['src/a.py', 'src/b.py']);
  assert.equal(n.private, false);
  assert.equal(parseNote('# Heading\ntext', { rel: 'a/file name.md' }).title, 'Heading'); assert.equal(parseNote('text only', { rel: 'a/file name.md' }).title, 'file name');
  assert.equal(parseNote('---\nalias: One\ntag: x y\n---\nz').aliases[0], 'One');
  assert.equal(parseNote('---\nprivate: true\n---\nx').private, true); assert.equal(parseNote('x #secret', { privateTags: ['secret'] }).private, true); assert.equal(parseNote('---\ntags: [Private/work]\n---\nx').private, true);
});
test('parseNote: etiquetas ignoram cercas, títulos, código, números e âncoras', () => {
  const n = parseNote('# Heading #notatag\ntext #Idea and #a/b, #123 and `#code` and\n```\n#fenced\n```\nurl http://x.com/#anchor [[Note#Head]] mail a#b &#39;\n- #last-one', { rel: 'n.md' });
  assert.deepEqual(n.tags.sort(), ['a/b', 'idea', 'last-one']);
});
test('parseNote: links com apelido, título, bloco, embed, Markdown e cercas', () => {
  const text = '[[A]] [[B|alias]] [[C#Heading]] [[D#^block]] ![[E]] ![[pic.png]] [x](sub/F.md) [y](../G%20H.md) [z](https://x.com/a.md) [[calc.py]] [[#same]] `[[InCode]]`\n```\n[[Hidden]]\n```\n';
  const n = parseNote(text, { rel: 'dir/n.md' });
  assert.deepEqual(n.links, ['A', 'B', 'C', 'D', 'E', 'InCode', 'dir/sub/F', 'G H']);
  assert.deepEqual(n.codeMentions.paths, [{ path: 'calc.py', via: 'link' }]);
});
test('parseNote: menções de código por caminho, nome, símbolo e identificador', () => {
  const n = parseNote('---\ncode: src/fm.py\n---\nSee src/billing/calc.py:42 and calc.py. Call `round_invoice()` and `Invoice.total` or `calc.round_invoice()`, not `ls -la` nor `x`. File `src/a/b.ts` too.', { rel: 'n.md' });
  const paths = Object.fromEntries(n.codeMentions.paths.map(p => [p.path, p.via]));
  assert.deepEqual(paths, { 'src/fm.py': 'frontmatter', 'src/billing/calc.py': 'mention', 'calc.py': 'mention', 'src/a/b.ts': 'mention' });
  assert.deepEqual(n.codeMentions.symbols.sort(), ['Invoice', 'calc', 'round_invoice', 'total']);
  assert.equal(parseNote('x'.repeat(400), { rel: 'n.md' }).description.length, 160);
  assert.equal(parseNote('# T\nfirst [[Link|shown]] line\n## Sub\nmore', { rel: 'n.md' }).description, 'first shown line more'); assert.deepEqual(parseNote('# T\n## S1\n### S2\n#### S3\n##### S4', { rel: 'n.md' }).headings, ['S1', 'S2', 'S3']);
});
test('resolveLinks: pasta de origem, apelido, sufixo de caminho, privadas e autolinks', () => {
  const mk = (key, extra = {}) => ({ key, title: key, aliases: [], links: [], ...extra });
  const list = [mk('v/a/Plan.md'), mk('v/b/Plan.md'), mk('v/a/Src.md', { links: ['Plan', 'b/Plan', 'rounding', 'Src', 'Secret', 'missing'] }), mk('v/b/Other.md', { links: ['Plan'] }), mk('v/c/x.md', { links: ['Plan', 'a/deep/Deep'] }), mk('v/d/Alias.md', { aliases: ['Rounding'] }), mk('v/Secret.md', { private: true, links: ['Plan'] }), mk('v/a/deep/Deep.md')];
  const r = resolveLinks(list);
  assert.deepEqual(r[2].out, [1, 5, 0].sort((a, b) => a - b)); assert.equal(r[2].unresolved, 2); // Secret (privada) e missing
  assert.deepEqual(r[3].out, [1]); assert.deepEqual(r[4].out, [0, 7]);
  assert.deepEqual(r[0].in, [2, 4]); assert.deepEqual(r[6], { out: [], in: [], unresolved: 0, superseded: [], supersedes: [] });
  assert.ok(!r[0].out.includes(0) && !r[2].out.includes(2) && r.every(x => !x.in.includes(6) && !x.out.includes(6)));
  const deep = resolveLinks([mk('v/a/deep/Plan.md'), mk('v/b/Plan.md'), mk('v/z/x.md', { links: ['Plan'] })]); assert.deepEqual(deep[2].out, [1]); // caminho mais curto
});
test('linkCode: caminho, sufixo, nome único e ambíguo, e símbolo em até 3 arquivos', () => {
  const index = { files: [
    { file: 'src/billing/calc.py', simbolos: ['round_invoice()', 'Invoice', '.total()'] }, { file: 'src/shipping/calc.py', simbolos: ['ship()'] }, { file: 'src/billing/models.py', simbolos: ['Invoice'] }, { file: 'src/util.py', simbolos: ['common'] },
    ...['a', 'b', 'c', 'd'].map(d => ({ file: 'src/' + d + '/one.py', simbolos: ['common', 'Only' + d] })),
  ] };
  const note = (key, title, mentions, symbols = []) => ({ key, title, codeMentions: { paths: mentions.map(([path, via]) => ({ path, via })), symbols } });
  const out = linkCode([
    note('v/Billing/n1.md', 'Invoices', [['src/util.py', 'mention'], ['billing/models.py', 'mention'], ['util.py', 'link'], ['calc.py', 'mention'], ['one.py', 'mention']], ['round_invoice', 'Invoice', 'common', 'nothing', 'ONLYA']),
    note('v/Misc/n2.md', 'Other', [['calc.py', 'mention']]), note('v/Billing/n3.md', 'x', [['src/billing/calc.py', 'mention'], ['src/billing/calc.py', 'frontmatter'].slice(0, 2)]),
    { key: 'v/p.md', title: 'p', private: true, codeMentions: { paths: [{ path: 'src/util.py', via: 'mention' }], symbols: [] } },
  ], index);
  const files = out[0].map(c => c.file + ':' + c.via);
  assert.deepEqual(files.slice(0, 3), ['src/util.py:link', 'src/billing/calc.py:mention', 'src/billing/models.py:mention']); // por via, depois por nome
  assert.deepEqual(new Map(out[0].map(c => [c.file, c.via])), new Map([['src/util.py', 'link'], ['src/billing/models.py', 'mention'], ['src/billing/calc.py', 'mention'], ['src/a/one.py', 'symbol']]));
  assert.ok(!out[0].some(c => c.file.endsWith('/one.py') && c.via === 'mention')); // one.py: 4 arquivos, ambíguo
  assert.ok(!out[0].some(c => c.file === 'src/shipping/calc.py')); assert.deepEqual(out[1], []); assert.deepEqual(out[3], []);
  assert.equal(out[0][0].via, 'link'); assert.equal(linkCode([note('v/x.md', 'x', [])], null)[0].length, 0);
});
test('brainConfig: validação, vaults externos, rótulos e ausência', async t => {
  const root = await vault(t, {}, undefined);
  const set = async brain => writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [], ...(brain === undefined ? {} : { brain }) }));
  await set(); assert.equal(await brainConfig(root), null); await set({ roots: [] }); assert.equal(await brainConfig(root), null);
  const bad = [{ roots: ['..'] }, { roots: ['/abs'] }, { roots: ['a\\b'] }, { roots: ['.git'] }, { roots: [1] }, { roots: Array(21).fill('a') }, { roots: ['notes'], exclude: [1] }, { roots: ['notes'], exclude: Array(201).fill('x') }, { roots: ['notes'], private_tags: Array(51).fill('x') }, { roots: ['notes'], private_tags: [1] }, { roots: ['notes'], inbox: '..' }, { roots: ['notes'], inbox: '.' }, { roots: 'x' }, 'x', null];
  await mkdir(resolve(root, 'notes'), { recursive: true });
  for (const brain of bad) { await set(brain); await assert.rejects(brainConfig(root), /Invalid configuration in brain: /, JSON.stringify(brain)); }
  await set({ roots: ['missing'] }); await assert.rejects(brainConfig(root), /Brain folder not found/);
  const outside = resolve(root, '..', 'ext-vault-' + Date.now()); await mkdir(outside); t.after(() => import('node:fs/promises').then(f => f.rm(outside, { recursive: true, force: true })));
  await set({ roots: ['notes'], exclude: ['Templates'], private_tags: ['#Secret'], inbox: 'Inbox/agent' });
  const c = await brainConfig(root, { brainDirs: [outside, outside] });
  assert.equal(c.vaults.length, 2); assert.equal(c.vaults[0].label, 'notes'); assert.ok(c.vaults[1].label.startsWith('ext-vault')); assert.deepEqual(c.privateTags, ['secret']); assert.equal(c.inbox, 'Inbox/agent');
  await set(undefined); assert.equal((await brainConfig(root, { brainDirs: [outside] })).vaults.length, 1); assert.deepEqual((await brainConfig(root, { brainDirs: [outside] })).privateTags, ['private']);
  await assert.rejects(brainConfig(root, { brainDirs: ['relative'] }), /Invalid brain folder/); await assert.rejects(brainConfig(root, { brainDirs: [resolve(root, 'nope')] }), /Invalid brain folder/);
});
test('walkBrain: só .md, sem ocultos, node_modules, ligações simbólicas e excluídos; nota grande é pulada', async t => {
  const root = await vault(t, { 'a.md': 'x', 'B/b.md': 'x', 'B/c.txt': 'x', '.obsidian/n.md': 'x', 'node_modules/n.md': 'x', 'Templates/t.md': 'x', 'Archive/2019/old.md': 'x', 'Archive/2020/ok.md': 'x', 'big.md': 'x'.repeat(262145) }, { roots: ['notes'], exclude: ['templates', 'Archive/2019'] });
  await write(root, 'alvo/link.md', 'x'); await symlink(resolve(root, 'alvo'), resolve(root, 'notes/ligada'), 'junction');
  const r = await walkBrain(await brainConfig(root));
  assert.deepEqual(r.files.map(f => f.vault + '/' + f.rel), ['notes/Archive/2020/ok.md', 'notes/B/b.md', 'notes/a.md']);
  assert.deepEqual(r.skipped, [{ vault: 'notes', rel: 'big.md', reason: 'larger than 256 KiB' }]);
  assert.ok(r.files.every(f => f.size > 0 && f.mtimeMs > 0));
});
test('privacidade: nota privada nunca vai ao Jev nem volta, em todas as etapas e sem Jev', async t => {
  const root = await vault(t, notes, { roots: ['notes'], exclude: ['Templates'] });
  await codeIndex(root, { 'src/billing/calc.py': ['round_invoice()'], 'src/util.py': ['x'] });
  const gone = (what, text) => { assert.ok(!text.includes(SECRET), what + ': segredo'); assert.ok(!text.includes(INLINE), what + ': segredo em linha'); assert.ok(!/quartz/i.test(text), what + ': título'); assert.ok(!text.includes('Mood'), what + ': título da nota com etiqueta'); assert.ok(!text.includes('Salary Plan'), what + ': título 2'); };
  for (const [name, extra, query] of [['completo pequeno', {}, 'round invoice totals'], ['ficha', { privacy: 'ficha' }, 'round invoice totals'], ['completo grande', { topFiles: 12 }, 'round invoice totals']]) {
    const { request, calls } = scripted();
    if (name === 'completo grande') await write(root, 'notes/Big/Filler.md', '# Filler\n' + 'filler words about nothing. '.repeat(3000));
    const r = await recall(root, query, opts({ key, request, ...extra }));
    assert.equal(r.corpus.private, 2, name); assert.ok(r.items.some(i => i.kind === 'note'), name);
    gone(name + ' (pedidos)', JSON.stringify(calls)); gone(name + ' (resultado)', JSON.stringify(r));
    assert.ok(!(await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8')).includes('Quartz'));
  }
  const local = await recall(root, 'salary mood feeling', opts({ jev: false }));
  gone('local', JSON.stringify(local));
  const up = await core.update(root, bogus(root));
  assert.equal(up.brain.private, 2); assert.equal(up.brain.notes, 6); // 8 arquivos - Template excluído - 2 privadas = 5 + Big/Filler
  gone('brain.json', await readFile(resolve(root, '.jev-graphify/brain.json'), 'utf8'));
  const idx = JSON.parse(await readFile(resolve(root, '.jev-graphify/brain.json'), 'utf8'));
  assert.ok(idx.notes.every(n => !n.code.some(c => c.file === 'src/billing/calc.py' && n.key.includes('Salary'))));
  const found = await findInProject(root, 'calc', { key, request: scripted().request });
  gone('project_find', JSON.stringify(found));
});
test('recall com Jev: fichas das notas com Links e Code, código no topo, vizinhos e substituída', async t => {
  const root = await vault(t, notes, { roots: ['notes'], exclude: ['Templates'] });
  await codeIndex(root, { 'src/billing/calc.py': ['round_invoice()', 'Invoice'], 'src/util.py': ['x'] });
  const { request, calls } = scripted();
  const r = await recall(root, 'how to round invoice totals', opts({ privacy: 'ficha', key, request }));
  assert.equal(r.status, 'ok'); assert.equal(r.strategy, 'cards');
  const cards = instructions(calls).filter(i => i.includes('Document [note: brain/notes/Billing/Invoice Rounding.md]'));
  assert.ok(cards.length === 1 && cards[0].includes('Document [note: brain/notes/Billing/Invoice Rounding.md]') && cards[0].includes('(aka Rounding)') && cards[0].includes('Links: ') && cards[0].includes('Tax Policy') && cards[0].includes('Code: src/billing/calc.py'), cards[0]);
  assert.ok(instructions(calls).some(i => i.includes('status: superseded (superseded by [[Rounding v2]])')));
  assert.ok(cards[0].length < 1500);
  const a = r.items.find(i => i.source === 'brain/notes/Billing/Invoice Rounding.md');
  assert.equal(a.kind, 'note'); assert.equal(a.code[0].file, 'src/billing/calc.py'); assert.equal(a.code[0].via, 'frontmatter'); assert.deepEqual(a.code[0].symbols, ['round_invoice()', 'Invoice']); assert.ok(a.code[0].path.endsWith('calc.py'));
  assert.deepEqual(a.links, ['Tax Policy']); // Rounding v1 também é devolvida (ALTO), Salary some
  assert.deepEqual(r.code.map(c => c.file), ['src/billing/calc.py']);
  const v1 = r.items.find(i => i.source === 'brain/notes/Decisions/Rounding v1.md');
  assert.equal(v1.status, 'superseded'); assert.equal(v1.superseded_by, 'Rounding v2');
  // A vigente (BAIXO para o Jev) entra no resultado logo antes da substituída, com a relevância dela.
  const at = s => r.items.findIndex(i => i.source === 'brain/notes/Decisions/' + s + '.md');
  assert.ok(at('Rounding v2') >= 0 && at('Rounding v2') === at('Rounding v1') - 1, JSON.stringify(r.items.map(i => i.source)));
  assert.equal(r.items[at('Rounding v2')].relevance, v1.relevance);
  assert.ok(!r.related.some(x => x.title === 'Rounding v2'));
  assert.ok(!(r.near ?? []).some(x => r.items.some(i => i.source === x.source)));
  assert.ok(r.related.some(x => x.title === 'Tax Policy' && x.reason === 'linked'));
  assert.ok(r.related.length <= 5); assert.ok(r.corpus.notes === 5 && r.trust === 'untrusted_project_data');
});
test('substituições: cadeia põe a mais nova na frente e ciclo não trava', async t => {
  const root = await vault(t, {
    'D1.md': '---\nsuperseded_by: "[[D2]]"\n---\n# D1\nALTO: retry every 30 seconds.\n',
    'D2.md': '---\nsuperseded_by: "[[D3]]"\n---\n# D2\nBAIXO: retry with backoff.\n',
    'D3.md': '---\nsupersedes: "[[D2]]"\n---\n# D3\nBAIXO: retry with backoff and jitter.\n',
    'X.md': '---\nsuperseded_by: "[[Y]]"\n---\n# X\nALTO: loop one.\n',
    'Y.md': '---\nsuperseded_by: "[[X]]"\n---\n# Y\nMEDIO: loop two.\n',
  });
  for (const privacy of ['ficha', 'completo']) {
    const r = await recall(root, 'retry policy', opts({ privacy, key, request: scripted().request }));
    const order = r.items.map(i => i.source.split('/').pop());
    assert.ok(order.indexOf('D3.md') >= 0 && order.indexOf('D3.md') < order.indexOf('D2.md') && order.indexOf('D2.md') < order.indexOf('D1.md'), privacy + ': ' + order.join(','));
    assert.ok(order.includes('X.md') && order.includes('Y.md'));
  }
});
test('recall completo pequeno lê as notas inteiras e o texto vai ao Jev só das públicas', async t => {
  const root = await vault(t, notes, { roots: ['notes'], exclude: ['Templates'] });
  const { request, calls } = scripted();
  const r = await recall(root, 'rounding decision', opts({ key, request }));
  assert.equal(r.strategy, 'full'); assert.deepEqual([...new Set(r.items.map(i => i.kind))].sort(), ['note']);
  assert.ok(instructions(calls).some(i => i.includes('Passage [note: brain/notes/Decisions/Rounding v1.md')));
  assert.ok(r.items.every(i => !i.text.includes('Salary')));
  const order = r.items.map(i => i.source.split('/').pop());
  assert.ok(order.indexOf('Rounding v2.md') >= 0 && order.indexOf('Rounding v2.md') < order.indexOf('Rounding v1.md'), order.join(','));
  assert.ok(r.items.find(i => i.source.endsWith('Invoice Rounding.md')).text.includes('[private note]'));
});
test('etapa de núcleos: só com mais de 150 notas e 6 comunidades; ficam os melhores', async t => {
  const dirs = Array.from({ length: 8 }, (_, d) => 'F' + d), all = {};
  for (const d of dirs) for (let i = 0; i < 20; i++) all[d + '/n' + i + '.md'] = '# ' + d + ' note ' + i + (d === 'F3' ? ' ALTO' : '') + '\nBody of ' + d + ' note ' + i + '.\n';
  const root = await vault(t, all);
  const up = await core.update(root, bogus(root)); assert.equal(up.brain.notes, 160); assert.equal(up.brain.clustering, 'folders'); assert.equal(up.brain.nucleos, 8);
  const { request, calls } = scripted();
  const r = await recall(root, 'something', opts({ privacy: 'ficha', key, request, nucleos: 2 }));
  assert.equal(r.stages.nucleos.communities, 8); assert.equal(r.stages.nucleos.kept.length, 2); assert.equal(r.stages.nucleos.kept[0].id, 3);
  assert.ok(r.stages.nucleos.notes < 160 && r.stages.nucleos.notes >= 20); assert.equal(r.stages.cards.files, r.stages.nucleos.notes + 1); // +1: policy.md
  assert.ok(r.items.length && r.items.every(i => i.source.startsWith('brain/notes/F3/') || i.kind !== 'note'));
  const purposes = (await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l).purpose);
  assert.deepEqual(purposes.filter(p => p === 'recall_nucleos').length, 1); assert.ok(purposes.includes('recall_cards'));
  assert.ok(instructions(calls).some(i => i.startsWith('Would any note in the group')));
  await assert.rejects(recall(root, 'x', opts({ key, request, nucleos: 31 })), /Invalid number of clusters/);
  // Com 150 notas ou menos não há etapa de núcleos.
  const small = await vault(t, Object.fromEntries(Object.entries(all).slice(0, 150)));
  await core.update(small, bogus(small));
  assert.equal((await recall(small, 'something', opts({ privacy: 'ficha', key, request }))).stages.nucleos, undefined);
});
test('sem Jev, índice ausente, velho ou inválido: recall continua funcionando', async t => {
  const root = await vault(t, notes, { roots: ['notes'], exclude: ['Templates'] });
  await codeIndex(root, { 'src/billing/calc.py': ['round_invoice()'] });
  const local = await recall(root, 'rounding invoice', opts({ jev: false }));
  assert.equal(local.status, 'local'); assert.equal(local.strategy, 'local'); assert.ok(local.items[0].kind === 'note' && local.items.some(i => i.source.endsWith('Invoice Rounding.md')));
  assert.equal(local.items.find(i => i.source.endsWith('Invoice Rounding.md')).code[0].file, 'src/billing/calc.py');
  assert.equal((await recall(root, 'aka Rounding', opts({ jev: false }))).items[0].source, 'brain/notes/Billing/Invoice Rounding.md'); // apelido está no título/ficha da nota
  await write(root, '.jev-graphify/brain.json', '{ not json');
  assert.equal((await recall(root, 'rounding invoice', opts({ jev: false }))).status, 'local');
  await write(root, '.jev-graphify/brain.json', JSON.stringify({ schema: 1, project: 'other', notes: [], nucleos: [] }));
  assert.equal((await recall(root, 'rounding invoice', opts({ key, request: scripted().request }))).status, 'ok');
  assert.equal((await core.status(root)).brain.status, 'missing');
  assert.equal((await core.update(root, bogus(root))).brain.status, 'updated');
  assert.equal((await core.status(root)).brain.status, 'current');
  await write(root, 'notes/New.md', '# New\nhello'); assert.equal((await core.status(root)).brain.status, 'stale');
});
test('sem brain nada muda: update e status mantêm o formato e recall ignora o cofre', async t => {
  const { root } = await fixture(t);
  assert.equal((await core.status(root)).brain.status, 'not_configured');
  const up = await core.update(root); assert.ok(!('brain' in up));
  await write(root, 'notes/Loose.md', '# Loose\nAurora');
  const r = await recall(root, 'Aurora', opts({ jev: false }));
  assert.ok(r.items.every(i => i.kind !== 'note') && !('code' in r) && !('notes' in r.corpus));
});
test('update: brain.json com núcleos, sem texto de nota; Graphify ausente cai para pastas; limpa a pasta de trabalho', async t => {
  const root = await vault(t, notes, { roots: ['notes'], exclude: ['Templates'] });
  await codeIndex(root, { 'src/billing/calc.py': ['round_invoice()'] });
  const up = await core.update(root, bogus(root));
  assert.equal(up.brain.status, 'updated'); assert.equal(up.brain.clustering, 'folders'); assert.match(up.brain.fallback, /Python not found/); assert.equal(up.brain.private, 2);
  const idx = JSON.parse(await readFile(resolve(root, '.jev-graphify/brain.json'), 'utf8'));
  assert.equal(idx.schema, 1); assert.equal(idx.graphify, null); assert.deepEqual(idx.vaults, ['notes']); assert.equal(idx.project, hash(await realpath(root)));
  assert.equal(idx.notes.length, 5); assert.ok(idx.notes.every(n => typeof n.nucleo === 'number' && n.stamp && n.title));
  assert.deepEqual(idx.notes.find(n => n.key === 'notes/Billing/Invoice Rounding.md').code, [{ file: 'src/billing/calc.py', via: 'frontmatter' }]);
  assert.ok(!JSON.stringify(idx).includes('round invoice totals')); // nenhum texto de nota no índice
  assert.ok(idx.nucleos.every(n => n.notes >= 1 && Array.isArray(n.folders) && Array.isArray(n.tags) && Array.isArray(n.titles) && Array.isArray(n.code)));
  assert.deepEqual((await readdir(resolve(root, '.jev-graphify'))).filter(n => n.includes('stage')), []);
  assert.equal((await core.update(root, bogus(root))).brain.status, 'updated'); // folha de pastas tenta o Graphify de novo
  // brainDirs externo: o integrador traz o cofre de fora do projeto.
  const other = await fixture(t), ext = resolve(other.root, 'vault-ext'); await write(other.root, 'vault-ext/Idea.md', '# Idea\nhello');
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: ['policy.md'], skills: ['skill.md'] }));
  const ext2 = await core.update(root, { ...bogus(root), brainDirs: [ext] });
  assert.equal(ext2.brain.notes, 1); assert.equal(JSON.parse(await readFile(resolve(root, '.jev-graphify/brain.json'), 'utf8')).notes[0].key, 'vault-ext/Idea.md');
  assert.equal((await core.status(root, { brainDirs: [ext] })).brain.status, 'current');
  assert.equal((await core.status(root)).brain.status, 'not_configured');
});
test('project_find ganha o porquê: notas que ligam ao arquivo, vindas do índice', async t => {
  const root = await vault(t, notes, { roots: ['notes'], exclude: ['Templates'] });
  await codeIndex(root, { 'src/billing/calc.py': ['round_invoice()'], 'src/util.py': ['helper()'] });
  const ask = () => findInProject(root, 'round invoice calc', { key, request: scripted({ values: { 'src/billing/calc.py': 0.9, 'src/util.py': 0.3 } }).request });
  assert.ok((await ask()).items.every(i => !('notes' in i)));
  await core.update(root, bogus(root));
  const r = await ask(), calc = r.items.find(i => i.file === 'src/billing/calc.py');
  assert.deepEqual(calc.notes.map(n => n.title), ['Invoice Rounding']); assert.equal(calc.notes[0].source, 'brain/notes/Billing/Invoice Rounding.md'); assert.equal(calc.notes[0].via, 'frontmatter');
  assert.ok(!('notes' in r.items.find(i => i.file === 'src/util.py')));
});
test('note_capture: nunca sobrescreve, faz slug, esconde segredos e recusa saída do cofre', async t => {
  const root = await vault(t, { 'Existing.md': '# Existing\nx' }, { roots: ['notes'], inbox: 'Inbox/agent' });
  assert.equal(await hasInbox(root), true);
  const body = 'We chose banker rounding. token: ' + 'sk-' + 'a'.repeat(30) + '\n';
  const a = await captureNote(root, { title: 'Árvore de Decisão: Rounding!', body, tags: ['#billing', 'two words'], links: ['Invoice Rounding', 'Bad [[x]]|y'], code: ['src/billing/calc.py'] });
  assert.equal(a.status, 'saved'); const today = new Date().toISOString().slice(0, 10);
  assert.equal(a.source, 'brain/notes/Inbox/agent/' + today + ' arvore-de-decisao-rounding.md');
  const text = await readFile(a.path, 'utf8');
  assert.ok(text.startsWith('---\ntitle: "Árvore de Decisão: Rounding!"\ntype: agent-note\ncreated: ') && text.includes('source: agent') && text.includes('tags: ["billing","two-words"]') && text.includes('code: ["src/billing/calc.py"]'));
  assert.ok(text.includes('[REDACTED]') && !text.includes('sk-aaaa') && text.trimEnd().endsWith('Related: [[Invoice Rounding]], [[Bad xy]]'));
  const parsed = parseNote(text, { rel: 'Inbox/agent/x.md' }); assert.equal(parsed.title, 'Árvore de Decisão: Rounding!'); assert.ok(parsed.links.includes('Invoice Rounding')); assert.equal(parsed.type, 'agent-note');
  const b = await captureNote(root, { title: 'Árvore de Decisão: Rounding!', body: 'again' }), c = await captureNote(root, { title: 'Árvore de Decisão: Rounding!', body: 'third' });
  assert.ok(b.path.endsWith(' 2.md') && c.path.endsWith(' 3.md')); assert.ok((await readFile(a.path, 'utf8')).includes('banker rounding'));
  assert.equal((await readdir(resolve(root, 'notes/Inbox/agent'))).length, 3);
  for (const bad of [null, {}, { title: '', body: 'x' }, { title: 'x', body: '' }, { title: 'x'.repeat(121), body: 'x' }, { title: 'x', body: 'x'.repeat(8001) }, { title: 'x', body: 'x', tags: Array(9).fill('a') }, { title: 'x', body: 'x', links: Array(11).fill('a') }, { title: 'x', body: 'x', code: ['../x.py'] }, { title: 'x', body: 'x', code: Array(11).fill('a.py') }]) await assert.rejects(captureNote(root, bad), /Invalid/, JSON.stringify(bad));
  // Pasta de entrada que é ligação simbólica para fora do cofre.
  await mkdir(resolve(root, 'outside'), { recursive: true }); await mkdir(resolve(root, 'notes/Link'), { recursive: true }); await symlink(resolve(root, 'outside'), resolve(root, 'notes/Link/agent'), 'junction');
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [], brain: { roots: ['notes'], inbox: 'Link/agent' } }));
  await assert.rejects(captureNote(root, { title: 'x', body: 'x' }), /Symbolic links/); assert.deepEqual(await readdir(resolve(root, 'outside')), []);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [], brain: { roots: ['notes'], inbox: '../escape' } }));
  await assert.rejects(captureNote(root, { title: 'x', body: 'x' }), /Invalid configuration in brain/); assert.equal(await hasInbox(root), false);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [], brain: { roots: ['notes'] } }));
  await assert.rejects(captureNote(root, { title: 'x', body: 'x' }), /No inbox configured/); assert.equal(await hasInbox(root), false);
});
test('MCP: note_capture só existe com brain.inbox; sem ele a sessão não paga a ferramenta', async t => {
  const names = async (brain) => {
    const root = await vault(undefined, { 'a.md': '# A' }, brain), transport = new StdioClientTransport({ command: process.execPath, args: [resolve('src/cli.mjs'), 'mcp', '--project', root, '--no-auto-memory'], stderr: 'pipe' });
    const client = new Client({ name: 'fixture-client', version: '1.0.0' });
    try { await client.connect(transport); const list = await client.listTools(); return { tools: list.tools, client, root }; }
    catch (e) { await client.close(); await cleanup(root); throw e; }
  };
  const withInbox = await names({ roots: ['notes'], inbox: 'Inbox' });
  try {
    const tool = withInbox.tools.find(x => x.name === 'note_capture');
    assert.ok(tool && tool.description.length <= 200 && tool.annotations.readOnlyHint === false && tool.annotations.destructiveHint === false && tool.annotations.openWorldHint === false);
    const saved = JSON.parse((await withInbox.client.callTool({ name: 'note_capture', arguments: { title: 'From agent', body: 'hello' } })).content[0].text);
    assert.equal(saved.status, 'saved'); assert.ok((await readFile(saved.path, 'utf8')).includes('hello'));
    const strict = await withInbox.client.callTool({ name: 'note_capture', arguments: { title: 'x', body: 'y', extra: 1 } }); assert.equal(strict.isError, true);
    assert.ok(withInbox.tools.every(x => x.description.length <= 220));
  } finally { await withInbox.client.close(); await cleanup(withInbox.root); }
  for (const brain of [{ roots: ['notes'] }, { roots: ['..'], inbox: 'Inbox' }]) {
    const without = await names(brain);
    try { assert.ok(!without.tools.some(x => x.name === 'note_capture'), JSON.stringify(brain)); assert.ok(without.tools.some(x => x.name === 'memory_recall')); }
    finally { await without.client.close(); await cleanup(without.root); }
  }
});
