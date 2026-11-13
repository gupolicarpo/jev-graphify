import { mkdir, mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { hash, atomicJson } from '../src/files.mjs';
export const work = resolve('work');
export async function fixture(t) {
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(resolve(work, 'test-'));
  t?.after(() => cleanup(root));
  const files = { 'policy.md': '# Faturas\nUse ROUND_HALF_UP para arredondar faturas. A regra Aurora cobra 1.01 para 1.005.', 'code.py': 'def checkout():\n    return 1\n', 'skill.md': '---\nname: rounding\ndescription: Corrigir arredondamento de faturas.\n---\nConsulte policy.md.\n' };
  const config = { version: 1, sources: ['policy.md', 'code.py'], skills: ['skill.md'] };
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify(config));
  for (const [name, body] of Object.entries(files)) await writeFile(resolve(root, name), body);
  const records = ['policy.md', 'code.py', 'skill.md'].map(source => {
    const kind = source === 'skill.md' ? 'skill' : 'reference', body = files[source];
    return { id: hash(kind + ':' + source), kind, title: (body.match(/^#\s+(.+)$/m)?.[1] || source).slice(0, 100), description: (body.match(/^description:\s*(.+)$/m)?.[1] || body.replace(/\s+/g, ' ')).slice(0, 400), source, version: hash(body), body };
  });
  // Synthetic fixture: real Graphify execution is tested separately.
  const graph = { generator: 'fixture', version: 'test', directed: true, nodes: [{ id: 'a', title: 'checkout', source: 'code.py' }, { id: 'b', title: 'billing_rule', source: 'policy.md' }], edges: [{ source: 'a', target: 'b' }] };
  const index = { schema: 1, project: hash(await realpath(root)), revision: hash(JSON.stringify(config) + JSON.stringify(records.map(r => [r.id, r.version]))), generatedAt: '2026-01-01T00:00:00Z', records, graph };
  await atomicJson(root, '.jev-graphify/index.json', index);
  return { root, records, config, index };
}
export async function cleanup(root) {
  const base = await realpath(work), target = await realpath(root), rel = relative(base, target);
  if (!rel || isAbsolute(rel) || rel.startsWith('..')) throw Error('Unsafe fixture cleanup');
  await rm(target, { recursive: true, force: true });
}
export const mockJev = (choice = 'c0', confidence = 0.9) => async () => new Response(JSON.stringify({ answers: { selection: { choice, confidence } }, usage: { input_tokens: 10, output_tokens: 2 } }), { headers: { 'content-type': 'application/json' } });
export const simulated = { key: 'fictional-test-credential', request: mockJev() };
export const recoveryInput = { task: 'Corrigir faturas', failure: 'Teste falhou: esperado 1.01 para entrada 1.005; recebido 1.00.', diagnosis: { kind: 'memory_gap', reason: 'Consultar regra de arredondamento de faturas.', evidence: 'esperado 1.01 para entrada 1.005', queries: ['ROUND_HALF_UP faturas'] } };
