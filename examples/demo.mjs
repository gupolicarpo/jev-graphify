import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as core from '../src/core.mjs';
const base = fileURLToPath(new URL('../work/', import.meta.url));
await mkdir(base, { recursive: true });
const root = await mkdtemp(resolve(base, 'demo-'));
try {
  await cp(fileURLToPath(new URL('./project/', import.meta.url)), root, { recursive: true, filter: path => !path.includes('.jev-graphify' + (process.platform === 'win32' ? '\\' : '/')) && !path.endsWith('.jev-graphify') });
  const buggy = 'def round_invoice(value):\n    return round(value, 2)\n';
  await writeFile(resolve(root, 'calc.py'), buggy);
  await writeFile(resolve(root, 'verify.py'), `from decimal import Decimal\nimport runpy\nf = runpy.run_path('calc.py')['round_invoice']\nactual = Decimal(str(f(1.005)))\nassert actual == Decimal('1.01'), f'expected 1.01 for 1.005; got {actual}'\nprint('invoice check passed')\n`);
  const verify = () => spawnSync(process.env.JEV_GRAPHIFY_PYTHON || 'python', ['-I', resolve(root, 'verify.py')], { cwd: root, encoding: 'utf8', windowsHide: true });
  const before = verify(); assert.equal(before.status, 1);
  console.log('1. REAL test failed in the fictional example: expected 1.01 for 1.005.');
  const generated = await core.update(root); assert.equal(generated.status, 'updated');
  console.log('2. REAL Graphify, local and without an LLM:', JSON.stringify(generated));
  const task = 'Corrigir arredondamento de faturas';
  // In-memory service simulation: no HTTP request and no real credential.
  const options = { key: 'fictional-demo-credential', request: async (_, request) => {
    const criteria = JSON.parse(request.body).questions.selection.criteria;
    const choice = Object.keys(criteria).find(k => k !== 'none' && /faturas/i.test(criteria[k])) || 'none';
    return new Response(JSON.stringify({ answers: { selection: { choice, confidence: 0.95 } } }));
  } };
  const route = await core.route(root, task, options);
  assert.equal(route.skill.status, 'selected'); console.log('3. SIMULATED Jev selection:', route.skill.status, route.reference.status);
  const plan = await core.recover(root, { task, failure: before.stderr, diagnosis: { kind: 'memory_gap', reason: 'Consultar regra de arredondamento.', evidence: 'expected 1.01 for 1.005', queries: ['Arredondamento de faturas'] } }, options);
  assert.equal(plan.status, 'ready_for_executor'); assert.match(plan.memories[0].body, /ROUND_HALF_UP/);
  console.log('4. Recovered context:', plan.status, plan.memories[0].source);
  // Scripted executor fixture: consume the recovered policy and modify only this known example.
  assert.equal(await readFile(resolve(root, 'calc.py'), 'utf8'), buggy);
  await writeFile(resolve(root, 'calc.py'), 'from decimal import Decimal, ROUND_HALF_UP\ndef round_invoice(value):\n    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)\n');
  const after = verify(); assert.equal(after.status, 0, after.stderr);
  console.log('5. SIMULATED executor fixed the file; the same REAL test passed. No paid call.');
} finally {
  const target = await realpath(root), rel = relative(await realpath(base), target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Unsafe demo cleanup');
  await rm(target, { recursive: true, force: true });
}
