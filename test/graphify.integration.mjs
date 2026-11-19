import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, unlink, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixture } from './helpers.mjs';
import * as core from '../src/core.mjs';
test('Graphify REAL cria, atualiza, remove nós e preserva índice na falha', { skip: !process.env.JEV_GRAPHIFY_PYTHON }, async t => {
  const { root, config } = await fixture(t);
  await unlink(resolve(root, '.jev-graphify/index.json'));
  const first = await core.update(root); assert.equal(first.status, 'updated');
  const load = async () => JSON.parse(await readFile(resolve(root, '.jev-graphify/index.json'), 'utf8'));
  assert.ok((await load()).graph.nodes.some(n => n.title.includes('checkout')));
  assert.equal((await core.update(root)).status, 'unchanged');
  await writeFile(resolve(root, 'code.py'), 'def refund():\n    return 2\n');
  assert.equal((await core.status(root)).status, 'stale');
  const second = await core.update(root); assert.notEqual(first.revision, second.revision);
  const g = (await load()).graph;
  assert.ok(g.nodes.some(n => n.title.includes('refund'))); assert.ok(!g.nodes.some(n => n.title.includes('checkout')));
  const before = await readFile(resolve(root, '.jev-graphify/index.json'), 'utf8');
  await writeFile(resolve(root, 'policy.md'), '# Changed');
  await assert.rejects(core.update(root, { python: resolve(root, 'missing-python') }), /Graphify failed/);
  assert.equal(await readFile(resolve(root, '.jev-graphify/index.json'), 'utf8'), before);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, sources: ['policy.md'] }));
  assert.equal((await core.update(root)).nodes, 0);
  assert.equal((await core.search(root, 'checkout')).candidates.length, 0);
});
test('Graphify REAL indexa o código do projeto em núcleos', { skip: !process.env.JEV_GRAPHIFY_PYTHON }, async t => {
  const { root, config } = await fixture(t);
  await mkdir(resolve(root, 'src'));
  await writeFile(resolve(root, 'src/a.py'), `from b import beta

def alpha():
    return beta() + 1
`);
  await writeFile(resolve(root, 'src/b.py'), `from c import gamma

def beta():
    return gamma() + 1
`);
  await writeFile(resolve(root, 'src/c.py'), `def gamma():
    return 1

class Delta:
    def run(self):
        return gamma()
`);
  // Pasta chamada "config" é comum em código e não pode ser confundida com as fontes privadas da memória.
  await mkdir(resolve(root, 'src/config'));
  await writeFile(resolve(root, 'src/config/settings.py'), `def load_settings():
    return {"speed": 1}
`);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, code: { roots: ['src'] } }));
  const result = await core.update(root);
  assert.equal(result.project.status, 'updated');
  const index = JSON.parse(await readFile(resolve(root, '.jev-graphify/project.json'), 'utf8'));
  assert.equal(index.files.length, 4); assert.ok(index.files.some(f => f.file === 'src/config/settings.py'));
  for (const f of index.files) { assert.ok(f.simbolos.length >= 1, f.file); assert.ok(Number.isInteger(f.nucleo), f.file); }
  assert.equal((await core.update(root)).project.status, 'unchanged');
  assert.equal((await core.status(root)).project.status, 'current');
  await writeFile(resolve(root, 'src/a.py'), `def alpha():
    return 2

def extra():
    return 3
`);
  assert.equal((await core.status(root)).project.status, 'stale'); assert.equal((await core.status(root)).project.changed, 1);
  // Atualização parcial: só o arquivo alterado é reanalisado, e o núcleo dele é mantido.
  const project = async () => JSON.parse(await readFile(resolve(root, '.jev-graphify/project.json'), 'utf8'));
  const nucleoDeA = index.files.find(f => f.file === 'src/a.py').nucleo;
  const partial = await core.update(root);
  assert.equal(partial.project.mode, 'incremental'); assert.equal(partial.project.changed, 1); assert.equal((await core.status(root)).project.status, 'current');
  const a = (await project()).files.find(f => f.file === 'src/a.py');
  assert.ok(a.simbolos.some(s => s.includes('extra')), a.simbolos.join(',')); assert.equal(a.nucleo, nucleoDeA);
  // Arquivo novo herda o núcleo dos vizinhos de pasta; arquivo removido sai do índice.
  await writeFile(resolve(root, 'src/d.py'), `def delta_new():
    return 4
`);
  await unlink(resolve(root, 'src/c.py'));
  const next = await core.update(root);
  assert.equal(next.project.mode, 'incremental'); assert.equal(next.project.changed, 2);
  const now = await project();
  assert.deepEqual(now.files.map(f => f.file), ['src/a.py', 'src/b.py', 'src/config/settings.py', 'src/d.py']);
  assert.ok(Number.isInteger(now.files.find(f => f.file === 'src/d.py').nucleo)); assert.ok(now.nucleos.every(n => n.arquivos.every(x => x !== 'src/c.py')));
  assert.equal((await core.update(root, { full: true })).project.mode, 'full');
  assert.deepEqual((await readdir(resolve(root, '.jev-graphify'))).filter(n => n.includes('stage')), []);
});
test('Graphify REAL agrupa o Second Brain (notas + código) em comunidades e cai para pastas sem Python', { skip: !process.env.JEV_GRAPHIFY_PYTHON }, async t => {
  const { root } = await fixture(t);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: ['policy.md'], skills: [], code: { roots: ['src'] }, brain: { roots: ['notes'] } }));
  await mkdir(resolve(root, 'src'), { recursive: true }); await mkdir(resolve(root, 'notes/X'), { recursive: true }); await mkdir(resolve(root, 'notes/Y'), { recursive: true });
  await writeFile(resolve(root, 'src/billing.py'), 'def round_invoice(x):\n    return round(x, 2)\n');
  await writeFile(resolve(root, 'src/shipping.py'), 'def ship_parcel(x):\n    return x\n');
  const notes = { 'X/A.md': '# A\nSee [[B]] and `round_invoice` in src/billing.py.', 'X/B.md': '# B\nBack to [[A]]. Uses billing.py.', 'Y/C.md': '# C\nSee [[D]] and `ship_parcel`.', 'Y/D.md': '# D\nBack to [[C]]. Uses shipping.py.', 'Y/Secret.md': '---\nprivate: true\n---\n# Secret\nhidden' };
  for (const [rel, text] of Object.entries(notes)) await writeFile(resolve(root, 'notes', rel), text);
  const first = await core.update(root);
  assert.equal(first.project.status, 'updated'); assert.equal(first.brain.status, 'updated'); assert.equal(first.brain.clustering, 'graphify'); assert.equal(first.brain.notes, 4); assert.equal(first.brain.private, 1); assert.ok(!first.brain.fallback);
  const load = async () => JSON.parse(await readFile(resolve(root, '.jev-graphify/brain.json'), 'utf8'));
  const idx = await load(), at = k => idx.notes.find(n => n.key === 'notes/' + k);
  assert.equal(idx.graphify.version, '0.9.107'); assert.ok(idx.graphify.communities >= 2);
  assert.equal(at('X/A.md').nucleo, at('X/B.md').nucleo); assert.equal(at('Y/C.md').nucleo, at('Y/D.md').nucleo); assert.notEqual(at('X/A.md').nucleo, at('Y/C.md').nucleo);
  assert.deepEqual(at('X/A.md').code.map(c => c.file), ['src/billing.py']); assert.ok(idx.nucleos.every(n => n.notes >= 1));
  assert.equal((await core.update(root)).brain.status, 'unchanged'); assert.equal((await core.status(root)).brain.status, 'current');
  assert.deepEqual((await readdir(resolve(root, '.jev-graphify'))).filter(n => n.includes('stage')), []);
  // Python indisponível: a atualização não falha, agrupa por pasta e diz isso.
  await writeFile(resolve(root, 'notes/X/B.md'), '# B\nBack to [[A]]. Changed.');
  const fallback = await core.update(root, { python: resolve(root, 'missing-python') });
  assert.equal(fallback.brain.status, 'updated'); assert.equal(fallback.brain.clustering, 'folders'); assert.match(fallback.brain.fallback, /Python not found/);
  const folders = await load(); assert.equal(folders.graphify, null); assert.equal(folders.notes.find(n => n.key === 'notes/X/A.md').nucleo, folders.notes.find(n => n.key === 'notes/X/B.md').nucleo);
  assert.notEqual(folders.notes.find(n => n.key === 'notes/X/A.md').nucleo, folders.notes.find(n => n.key === 'notes/Y/C.md').nucleo);
});
