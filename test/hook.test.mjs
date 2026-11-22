import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fixture } from './helpers.mjs';
import { hash, atomicJson, hookMode } from '../src/files.mjs';
import { walkCode, fingerprint } from '../src/project.mjs';
const hookFile = resolve('src/hook.mjs');
const prompt = 'please explain the ROUND_HALF_UP rounding rule for invoices policy';
// Sem chave: o hook usa só o ranking local, sem chamar o Jev.
function run(root, env = {}, input = { prompt, cwd: root }) {
  const clean = { ...process.env, JEV_API_KEY: '', JEV_GRAPHIFY_HOOK: '', JEV_GRAPHIFY_CONTEXT: '', JEV_GRAPHIFY_PROJECT: '', CLAUDE_PROJECT_DIR: '' };
  const r = spawnSync(process.execPath, [hookFile], { input: JSON.stringify(input), env: { ...clean, ...env }, encoding: 'utf8', timeout: 30000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
// Projeto mínimo com um índice de código (sem chave, só o ranking local) para o hook ter o que injetar.
async function project(t) {
  const { root } = await fixture(t);
  const code = Array.from({ length: 6 }, (_, b) => ['def invoice_rounding_' + b + '():', ...Array.from({ length: 30 }, (_, k) => '    value_' + b + '_' + k + ' = compute_total(' + k + ') + 12345')].join('\n') + '\n').join('\n');
  await mkdir(resolve(root, 'src'), { recursive: true });
  await writeFile(resolve(root, 'src/billing.py'), code);
  const config = JSON.parse(await readFile(resolve(root, '.jev-graphify.json'), 'utf8')), cfg = { roots: ['src'] };
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, code: cfg }));
  const { files: walked } = await walkCode(root, cfg), f = walked.find(w => w.rel === 'src/billing.py');
  const files = [{ file: 'src/billing.py', nucleo: 0, simbolos: ['invoice_rounding_0'], stamp: f.size + ':' + Math.round(f.mtimeMs) }];
  const nucleos = [{ id: 0, rotulos: [], pastas: ['src'], arquivos: ['src/billing.py'] }];
  await atomicJson(root, '.jev-graphify/project.json', { schema: 1, project: hash(await realpath(root)), generatedAt: '2026-01-01T00:00:00Z', fingerprint: fingerprint(walked), graphify: { version: '0.9.107', nodes: 1, edges: 0, communities: 1 }, files, nucleos });
  return { root };
}
async function configure(root, hook) {
  const config = JSON.parse(await readFile(resolve(root, '.jev-graphify.json'), 'utf8'));
  if (hook !== undefined) config.hook = hook;
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify(config));
}
const logged = async root => { try { return (await readFile(resolve(root, '.jev-graphify/hook.jsonl'), 'utf8')).trim().split('\n').length; } catch { return 0; } };
const text = r => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
test('hook: sem a chave "hook" não faz nada (sem saída, sem log)', async t => {
  const { root } = await project(t);
  const r = run(root);
  assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.equal(await logged(root), 0);
  await configure(root, false);
  assert.equal(run(root).stdout, ''); assert.equal(await logged(root), 0);
});
test('hook: "full" e true entram no modo cheio, "compact" no compacto', async t => {
  const { root } = await project(t);
  for (const [hook, mode] of [['full', 'full'], [true, 'full'], ['compact', 'compact']]) {
    await configure(root, hook);
    const before = await logged(root), r = run(root);
    assert.equal(r.status, 0); assert.equal(await logged(root), before + 1, String(hook));
    assert.match(r.stdout, /UserPromptSubmit/);
    if (mode === 'full') assert.match(text(r), /## Code excerpts/); else assert.doesNotMatch(text(r), /## Code excerpts/);
  }
});
test('hook: JEV_GRAPHIFY_HOOK=1 liga sem configuração, =0 desliga mesmo com configuração, CONTEXT sobrepõe o modo', async t => {
  const { root } = await project(t);
  const on = run(root, { JEV_GRAPHIFY_HOOK: '1' });
  assert.equal(await logged(root), 1); assert.match(text(on), /## Code excerpts/);
  const compact = run(root, { JEV_GRAPHIFY_HOOK: '1', JEV_GRAPHIFY_CONTEXT: 'compact' });
  assert.doesNotMatch(text(compact), /## Code excerpts/);
  await configure(root, 'full');
  const off = run(root, { JEV_GRAPHIFY_HOOK: '0' });
  assert.equal(off.stdout, ''); assert.equal(await logged(root), 2);
  assert.doesNotMatch(text(run(root, { JEV_GRAPHIFY_CONTEXT: 'compact' })), /## Code excerpts/);
});
test('hook: valor inválido na chave "hook" conta como desligado, sem erro', async t => {
  const { root } = await project(t);
  for (const bad of ['everything', 1, [], {}, null]) {
    await configure(root, bad);
    const r = run(root);
    assert.equal(r.status, 0, JSON.stringify(bad)); assert.equal(r.stdout, ''); assert.equal(await logged(root), 0);
    assert.equal(await hookMode(root, {}), null);
  }
  await writeFile(resolve(root, '.jev-graphify.json'), '{ not json');
  assert.equal(run(root).stdout, '');
});
