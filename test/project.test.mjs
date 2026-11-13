import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir, symlink, realpath, utimes } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixture } from './helpers.mjs';
import { hash, atomicJson } from '../src/files.mjs';
import * as core from '../src/core.mjs';
import { walkCode, fingerprint, projectStatus, findInProject, codeConfig } from '../src/project.mjs';
const key = 'fictional-test-credential';
const reply = (answers, status = 200) => new Response(JSON.stringify({ answers, usage: { input_tokens: 7 } }), { status, headers: { 'content-type': 'application/json' } });
// Responde pela primeira marca (ALTO, MEDIO, BAIXO) achada nas instruções; sem marca, 0.05 (pergunta de arquivo) ou 0.9 se `all`.
function scripted({ calls = [], values = { ALTO: 0.9, MEDIO: 0.7, BAIXO: 0.01 }, status = () => 200 } = {}) {
  const request = async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const st = status(body); if (st !== 200) return new Response('x', { status: st });
    const answers = {};
    for (const [k, q] of Object.entries(body.questions)) answers[k] = { type: 'noul', noul: Object.entries(values).find(([m]) => q.instructions.includes(m))?.[1] ?? 0.05 };
    return reply(answers);
  };
  return { request, calls };
}
const write = async (root, file, text = 'def f():\n    return 1\n') => { await mkdir(resolve(root, file, '..'), { recursive: true }); await writeFile(resolve(root, file), text); };
async function configure(root, code) {
  const file = resolve(root, '.jev-graphify.json');
  await writeFile(file, JSON.stringify({ ...JSON.parse(await readFile(file, 'utf8')), code }));
}
// Índice feito à mão (sem Python), marcado como atual.
async function handIndex(root, code, files, nucleos) {
  const { files: walked } = await walkCode(root, code);
  const index = { schema: 1, project: hash(await realpath(root)), generatedAt: '2026-01-01T00:00:00Z', fingerprint: fingerprint(walked), graphify: { version: '0.9.107', nodes: 1, edges: 0, communities: nucleos.length }, files, nucleos };
  await atomicJson(root, '.jev-graphify/project.json', index);
  return index;
}
const sent = async root => (await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
test('configuração code: raízes e exclusões inválidas', async t => {
  const { root } = await fixture(t);
  assert.equal(await codeConfig(root), null);
  const bad = [{}, { roots: [] }, { roots: ['..'] }, { roots: ['/abs'] }, { roots: ['a\\b'] }, { roots: ['C:x'] }, { roots: ['.git'] }, { roots: ['a/../b'] }, { roots: [1] }, { roots: Array(21).fill('a') }, { roots: ['.'], exclude: [1] }, { roots: ['.'], exclude: Array(201).fill('x') }, { roots: ['.'], exclude: 'x' }, 'x', null];
  for (const code of bad) { await configure(root, code); await assert.rejects(codeConfig(root), /Configuração inválida em code: /, JSON.stringify(code)); }
  await configure(root, { roots: ['.', 'src/app'], exclude: ['Backups'] });
  assert.deepEqual(await codeConfig(root), { roots: ['.', 'src/app'], exclude: ['Backups'] });
  assert.equal((await core.status(root)).sources, 3); // inventory aceita a chave nova
});
test('sem code: projectStatus e findInProject dizem not_configured', async t => {
  const { root } = await fixture(t);
  assert.equal((await projectStatus(root)).status, 'not_configured');
  assert.equal((await findInProject(root, 'x')).status, 'not_configured');
  assert.equal((await core.status(root)).project.status, 'not_configured');
});
test('walkCode: recursão, extensões, pastas embutidas, exclude, junction, 1 MiB, raízes sobrepostas e ordem', async t => {
  const { root } = await fixture(t);
  for (const f of ['src/b.py', 'src/a.cs', 'src/deep/x/c.ts', 'src/readme.md', 'src/bin/no.py', 'src/OBJ/no.py', '.git/no.py', 'node_modules/no.js', 'src/secrets/no.py', 'src/.hidden.py', 'src/cert.pem', 'src/Backups/no.py', 'src/lib/_checkpoints/no.py', 'src/legacy/old/no.py', 'src/legacy/ok.py', 'src/legacyx/ok.py']) await write(root, f);
  await write(root, 'alvo/ligado.py');
  await symlink(resolve(root, 'alvo'), resolve(root, 'src/ligada'), 'junction');
  await write(root, 'src/grande.py', 'x'.repeat(1048577));
  const code = { roots: ['src'], exclude: ['backups', '_CHECKPOINTS', 'Src/Legacy/Old'] };
  const r = await walkCode(root, code);
  assert.deepEqual(r.files.map(f => f.rel), ['src/a.cs', 'src/b.py', 'src/deep/x/c.ts', 'src/legacy/ok.py', 'src/legacyx/ok.py']);
  assert.deepEqual(r.skipped, [{ rel: 'src/grande.py', reason: 'maior que 1 MiB' }]);
  assert.ok(r.files.every(f => f.size > 0 && f.mtimeMs > 0));
  const both = await walkCode(root, { roots: ['.', 'src'], exclude: ['alvo'] });
  assert.equal(both.files.length, new Set(both.files.map(f => f.rel)).size);
  assert.ok(both.files.some(f => f.rel === 'code.py') && both.files.some(f => f.rel === 'src/a.cs'));
  assert.ok(!both.files.some(f => f.rel.includes('ligada') || f.rel.startsWith('alvo')));
  await assert.rejects(walkCode(root, { roots: ['nao-existe'] }), /nao-existe/);
});
test('walkCode: acima de 6000 arquivos falha', async t => {
  const { root } = await fixture(t);
  await mkdir(resolve(root, 'm'));
  await Promise.all(Array.from({ length: 6001 }, (_, i) => writeFile(resolve(root, 'm', 'f' + i + '.py'), 'x')));
  await assert.rejects(walkCode(root, { roots: ['m'] }), /Código acima do limite/);
});
test('fingerprint muda com o tamanho do arquivo', async t => {
  const { root } = await fixture(t);
  await write(root, 'src/a.py', 'aa');
  const code = { roots: ['src'] }, before = fingerprint((await walkCode(root, code)).files);
  assert.equal(before, fingerprint((await walkCode(root, code)).files));
  await write(root, 'src/a.py', 'aaa');
  assert.notEqual(before, fingerprint((await walkCode(root, code)).files));
});
test('projectStatus: missing, current e stale', async t => {
  const { root } = await fixture(t);
  await write(root, 'src/a.py'); const code = { roots: ['src'] }; await configure(root, code);
  assert.equal((await projectStatus(root)).status, 'missing');
  await handIndex(root, code, [{ file: 'src/a.py', nucleo: 0, simbolos: ['f'] }], [{ id: 0, rotulos: ['f'], pastas: ['src/a.py'], arquivos: ['src/a.py'] }]);
  assert.deepEqual({ ...(await projectStatus(root)), generatedAt: 0 }, { status: 'current', files: 1, nucleos: 1, generatedAt: 0 });
  await write(root, 'src/a.py', 'def f():\n    return 22222\n');
  assert.equal((await projectStatus(root)).status, 'stale');
  await utimes(resolve(root, 'src/a.py'), new Date(), new Date(0));
  assert.equal((await core.status(root)).project.status, 'stale');
});
test('findInProject: validação e índice ausente', async t => {
  const { root } = await fixture(t);
  await configure(root, { roots: ['.'] });
  for (const q of ['', '  ', 'x'.repeat(4001), 5]) await assert.rejects(findInProject(root, q), /Consulta inválida/);
  for (const top of [0, 21, 1.5, '3']) await assert.rejects(findInProject(root, 'a', { top }), /Quantidade inválida/);
  for (const nucleos of [0, 31, 2.5]) await assert.rejects(findInProject(root, 'a', { nucleos }), /Número de núcleos inválido/);
  assert.equal((await findInProject(root, 'a')).status, 'missing');
});
const small = async t => {
  const { root } = await fixture(t); const code = { roots: ['src'] };
  const names = ['billing', 'refund', 'login', 'report'];
  for (const n of names) await write(root, `src/${n}.py`);
  await configure(root, code);
  const files = names.map((n, i) => ({ file: `src/${n}.py`, nucleo: i % 2, simbolos: [n + '_service', 'Aurora' + n] })).sort((a, b) => a.file < b.file ? -1 : 1);
  const index = await handIndex(root, code, files, [0, 1].map(id => ({ id, rotulos: ['x'], pastas: ['src/a'], arquivos: files.filter(f => f.nucleo === id).map(f => f.file) })));
  return { root, code, index };
};
test('findInProject: sem chave ranqueia localmente por tokens', async t => {
  const { root } = await small(t);
  const r = await findInProject(root, 'refund Aurora');
  assert.equal(r.status, 'local'); assert.equal(r.strategy, 'local'); assert.equal(r.reason, 'no_key'); assert.equal(r.stale, false);
  assert.equal(r.items[0].file, 'src/refund.py'); assert.equal(r.items[0].path, resolve(root, 'src/refund.py'));
  assert.equal(r.items.length, 4); assert.deepEqual(r.nucleos, []);
  assert.equal((await findInProject(root, 'zzzzzz')).items.length, 0);
  const off = await findInProject(root, 'refund', { key, jev: false });
  assert.equal(off.reason, 'turned_off'); assert.equal(off.items.length, 1);
  assert.equal((await findInProject(root, 'refund', { top: 1 })).items.length, 1);
});
test('findInProject: índice pequeno usa uma etapa só de arquivos (flat) e escreve o log sem cartões', async t => {
  const { root } = await small(t);
  const calls = [], { request } = scripted({ calls, values: { 'refund.py': 0.9, 'login.py': 0.01 } });
  const r = await findInProject(root, 'consertar o reembolso', { key, request });
  assert.equal(r.status, 'ok'); assert.equal(r.strategy, 'flat'); assert.equal(r.requests, 1); assert.equal(calls.length, 1);
  const qs = Object.values(calls[0].questions);
  assert.equal(qs.length, 4); assert.ok(qs.every(q => q.type === 'noul' && q.instructions.startsWith('Would the source file described here')));
  assert.deepEqual(calls[0].state, { request: 'consertar o reembolso' });
  assert.deepEqual(r.items.map(i => i.file), ['src/refund.py', 'src/billing.py', 'src/report.py']);
  assert.ok(r.items.every((i, n) => n === 0 || i.relevance <= r.items[n - 1].relevance)); assert.deepEqual(r.nucleos, []); assert.equal(r.usage.input_tokens, 7);
  assert.equal(r.trust, 'untrusted_project_data');
  const log = await sent(root); assert.equal(log.length, 1); assert.equal(log[0].purpose, 'project_files');
  assert.ok(!JSON.stringify(log).includes('refund'));
});
// 20 núcleos x 4 arquivos; ALTO/MEDIO/BAIXO aparecem nos rótulos para dirigir as respostas.
async function large(t) {
  const { root } = await fixture(t); const code = { roots: ['src'] }, files = [], nucleos = [];
  for (let c = 0; c < 20; c++) {
    const mark = c === 3 ? 'ALTO' : c === 7 ? 'MEDIO' : 'BAIXO', arquivos = [];
    for (let i = 0; i < 4; i++) {
      const file = `src/pasta${c}/mod${c}_${i}.py`; await write(root, file); arquivos.push(file);
      files.push({ file, nucleo: c, simbolos: Array.from({ length: 20 }, (_, k) => `${mark}_${i}_sym${k}`) });
    }
    nucleos.push({ id: c, rotulos: [mark], pastas: ['src/pasta' + c], arquivos });
  }
  await configure(root, code); files.sort((a, b) => a.file < b.file ? -1 : 1);
  await handIndex(root, code, files, nucleos);
  return root;
}
test('findInProject: índice grande pergunta núcleos e depois só os arquivos dos escolhidos', async t => {
  const root = await large(t), calls = [], { request } = scripted({ calls });
  const r = await findInProject(root, 'onde fica', { key, request, nucleos: 2, top: 20 });
  assert.equal(r.strategy, 'nucleos'); assert.equal(r.status, 'ok'); assert.equal(r.requests, 2);
  const [one, two] = calls;
  assert.equal(Object.keys(one.questions).length, 20); assert.ok(Object.values(one.questions).every(q => q.instructions.startsWith('Would any source file in the group')));
  assert.equal(Object.keys(two.questions).length, 8); assert.ok(Object.values(two.questions).every(q => q.instructions.startsWith('Would the source file described here')));
  assert.deepEqual(r.nucleos.map(n => n.id), [3, 7]); assert.deepEqual(r.nucleos.map(n => n.relevance), [0.9, 0.7]); assert.ok(r.nucleos.every(n => n.arquivos === 4));
  // arquivos dos núcleos 3 e 7 só: o ALTO/MEDIO dos símbolos vem do rótulo, então todos acima de 0.05
  assert.equal(r.items.length, 8); assert.ok(r.items.every(i => [3, 7].includes(i.nucleo)));
  assert.ok(r.items[0].relevance >= r.items.at(-1).relevance);
  assert.ok(r.items.every(i => i.simbolos.length === 12 && i.path === resolve(root, i.file)));
  const purposes = (await sent(root)).map(l => l.purpose).sort(); assert.deepEqual(purposes, ['project_files', 'project_nucleos']);
  assert.ok(!JSON.stringify(await sent(root)).includes('mod3_'));
  assert.equal((await findInProject(root, 'onde', { key, request, nucleos: 1, top: 3 })).items.length, 3);
  assert.equal((await findInProject(root, 'onde', { key, request, nucleos: 1, top: 3 })).nucleos.length, 1);
});
// 70 núcleos de 2 arquivos em `nMods` módulos (mod0..); o módulo `alto` marca ALTO, `medio` marca MEDIO e os demais BAIXO.
// Cada módulo tem ainda um arquivo direto na pasta (sem subpasta); com rootCluster há um núcleo de 2 arquivos na raiz do projeto.
async function modular(t, { nMods = 10, alto = 'mod2', medio = 'mod5', rootCluster = false } = {}) {
  const { root } = await fixture(t), code = { roots: ['.'] }, files = [], nucleos = [];
  const markOf = m => m === alto ? 'ALTO' : m === medio ? 'MEDIO' : 'BAIXO';
  const add = async (c, m, names) => {
    const arquivos = [];
    for (const file of names) { await write(root, file); arquivos.push(file); files.push({ file, nucleo: c, simbolos: [markOf(m) + '_sym_' + c] }); }
    nucleos.push({ id: c, rotulos: [markOf(m), 'rot' + c], pastas: [m], arquivos });
  };
  for (let c = 0; c < 70; c++) { const m = 'mod' + (c % nMods); await add(c, m, [`${m}/sub${c}/f${c}_0.py`, `${m}/sub${c}/f${c}_1.py`, ...(c < nMods ? [`${m}/top${c}.py`] : [])]); }
  if (rootCluster) await add(70, '(raiz)', ['raiz1.py', 'raiz2.py']);
  await configure(root, code); files.sort((a, b) => a.file < b.file ? -1 : 1);
  await handIndex(root, code, files, nucleos);
  return root;
}
const texts = call => Object.values(call.questions).map(q => q.instructions);
test('findInProject: índice com muitos núcleos e módulos usa três etapas (módulos, núcleos, arquivos)', async t => {
  const root = await modular(t), calls = [], { request } = scripted({ calls });
  const r = await findInProject(root, 'onde fica', { key, request, modulos: 2, nucleos: 2, top: 20 });
  assert.equal(r.strategy, 'modulos'); assert.equal(r.status, 'ok'); assert.equal(r.requests, 3); assert.equal(calls.length, 3);
  const [one, two, three] = calls;
  assert.equal(texts(one).length, 10);
  assert.ok(texts(one).every(q => q.startsWith('Would any source file in the code module described here') && q.includes('Module: ') && !q.includes('Group: ') && !q.includes('File: ')));
  const card = texts(one).find(q => q.includes('Módulo: mod2 '));
  assert.ok(card.includes('| 15 arquivos: ') && card.includes('Subpastas: sub') && card.includes('Símbolos: ALTO') && card.includes('top2') && !/Subpastas: [^|]*top2/.test(card));
  assert.equal(texts(two).length, 14); assert.ok(texts(two).every(q => q.startsWith('Would any source file in the group') && !q.includes('Module: ')));
  assert.ok(texts(two).every(q => q.includes('ALTO') || q.includes('MEDIO')));
  assert.equal(texts(three).length, 5); assert.ok(texts(three).every(q => q.startsWith('Would the source file described here') && !q.includes('Module: ') && !q.includes('Group: ')));
  assert.deepEqual(r.modulos, [{ nome: 'mod2', relevance: 0.9, arquivos: 15 }, { nome: 'mod5', relevance: 0.7, arquivos: 15 }]);
  assert.deepEqual(r.nucleos.map(n => n.id), [2, 12]); assert.equal(r.items.length, 5); assert.ok(r.items.every(i => [2, 12].includes(i.nucleo)));
  assert.deepEqual((await sent(root)).map(l => l.purpose), ['project_modulos', 'project_nucleos', 'project_files']);
  assert.ok(!JSON.stringify(await sent(root)).includes('sub2'));
});
test('findInProject: modulos limita os módulos escolhidos e o padrão é 5', async t => {
  const root = await modular(t), calls = [], { request } = scripted({ calls });
  const one = await findInProject(root, 'x', { key, request, modulos: 1, nucleos: 30 });
  assert.deepEqual(one.modulos.map(m => m.nome), ['mod2']); assert.equal(Object.keys(calls[1].questions).length, 7);
  assert.ok(one.nucleos.every(n => n.id % 10 === 2));
  calls.length = 0;
  const def = await findInProject(root, 'x', { key, request });
  assert.equal(def.modulos.length, 5); assert.deepEqual(def.modulos.map(m => m.nome).slice(0, 2), ['mod2', 'mod5']); assert.equal(Object.keys(calls[1].questions).length, 35);
  for (const bad of [0, 21, 1.5, '3']) await assert.rejects(findInProject(root, 'a', { modulos: bad }), /Número de módulos inválido \(1–20\)\./);
});
test('findInProject: arquivos na raiz formam o módulo (raiz)', async t => {
  const root = await modular(t, { alto: '(raiz)', medio: 'mod5', rootCluster: true }), calls = [], { request } = scripted({ calls });
  const r = await findInProject(root, 'x', { key, request, modulos: 1, nucleos: 1, top: 20 });
  assert.equal(r.strategy, 'modulos'); assert.equal(texts(calls[0]).length, 11);
  assert.deepEqual(r.modulos, [{ nome: '(raiz)', relevance: 0.9, arquivos: 2 }]);
  assert.deepEqual(r.items.map(i => i.file).sort(), ['raiz1.py', 'raiz2.py']);
});
test('findInProject: HTTP 500 na etapa de módulos cai no ranking local', async t => {
  const root = await modular(t);
  const r = await findInProject(root, 'ALTO_sym_2', { key, request: scripted({ status: () => 500 }).request });
  assert.equal(r.status, 'unavailable'); assert.equal(r.http, 500); assert.equal(r.strategy, 'modulos'); assert.equal(r.requests, 1);
  assert.deepEqual(r.modulos, []); assert.deepEqual(r.nucleos, []); assert.ok(r.items.length > 0);
});
test('findInProject: menos de 8 módulos mantém a estratégia de núcleos', async t => {
  const root = await modular(t, { nMods: 5, alto: 'mod2', medio: 'mod3' }), calls = [], { request } = scripted({ calls });
  const r = await findInProject(root, 'x', { key, request });
  assert.equal(r.strategy, 'nucleos'); assert.deepEqual(r.modulos, []); assert.equal(r.requests, 2);
  assert.equal(texts(calls[0]).length, 70); assert.ok(texts(calls[0]).every(q => q.startsWith('Would any source file in the group')));
});
test('findInProject: relevância baixa some; tudo baixo vira none', async t => {
  const root = await large(t);
  const r = await findInProject(root, 'x', { key, request: scripted({ values: { ALTO: 0.01, MEDIO: 0.01, BAIXO: 0.01 } }).request, nucleos: 2, top: 20 });
  assert.equal(r.status, 'none'); assert.deepEqual(r.items, []); assert.equal(r.strategy, 'nucleos');
  const mixed = await findInProject(root, 'x', { key, request: scripted({ values: { ALTO: 0.9, BAIXO: 0.049, MEDIO: 0.05 } }).request, nucleos: 3, top: 20 });
  assert.ok(mixed.items.every(i => i.relevance >= 0.05)); assert.ok(mixed.items.length > 0 && mixed.items.length < 12);
});
test('findInProject: índice defasado avisa stale e continua', async t => {
  const { root } = await small(t);
  await write(root, 'src/billing.py', 'def g():\n    return 22222\n');
  const r = await findInProject(root, 'billing', { key, request: scripted().request });
  assert.equal(r.stale, true); assert.equal(r.status, 'ok');
});
test('findInProject: HTTP 500 na etapa 1 ou 2 cai no ranking local com status unavailable', async t => {
  const root = await large(t);
  const one = await findInProject(root, 'ALTO_1_sym1', { key, request: scripted({ status: () => 500 }).request });
  assert.equal(one.status, 'unavailable'); assert.equal(one.http, 500); assert.equal(one.strategy, 'nucleos'); assert.equal(one.requests, 1);
  assert.equal(one.items[0].file, 'src/pasta3/mod3_1.py'); assert.deepEqual(one.nucleos, []);
  const two = await findInProject(root, 'ALTO_1_sym1', { key, request: scripted({ status: b => Object.keys(b.questions)[0].startsWith('f') ? 500 : 200 }).request });
  assert.equal(two.status, 'unavailable'); assert.equal(two.http, 500); assert.equal(two.requests, 2); assert.equal(two.items[0].file, 'src/pasta3/mod3_1.py');
  const bad = await findInProject(root, 'ALTO_1_sym1', { key, request: async () => reply({}) });
  assert.equal(bad.status, 'invalid');
});
test('update e status do núcleo: sem code não há chave project; só code não chama Graphify nem falha', async t => {
  const { root } = await fixture(t);
  assert.equal((await core.update(root)).project, undefined);
  assert.equal('project' in await core.update(root), false);
  // Só `code` (sem fontes): a parte clássica não precisa do Graphify; com Python inexistente só o índice de código falha.
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [], code: { roots: ['src'] } }));
  await write(root, 'src/a.py');
  await assert.rejects(core.update(root, { python: resolve(root, 'sem-python') }), /Python não encontrado/);
  assert.deepEqual((await readdir(resolve(root, '.jev-graphify'))).filter(n => n.startsWith('code-stage-')), []);
  await configure(root, { roots: ['vazio'] }); await mkdir(resolve(root, 'vazio'));
  await assert.rejects(core.update(root), /Nenhum arquivo de código encontrado/);
});
test('modulesOf: módulo grande é dividido pelas subpastas, até três níveis; pequeno fica inteiro', async () => {
  const { modulesOf, BIG_MODULE } = await import('../src/project.mjs');
  const files = ['solto.cs', 'Pequeno/a.cs', 'Pequeno/sub/b.cs'];
  for (let i = 0; i <= BIG_MODULE; i++) files.push(`Grande/${i % 2 ? 'Naval' : 'Models'}/f${i}.cs`);
  files.push('Grande/raiz.cs');
  for (let i = 0; i <= BIG_MODULE; i++) files.push(`Plano/f${i}.cs`);
  const m = modulesOf(files);
  assert.equal(m.get('solto.cs'), '(raiz)'); assert.equal(m.get('Pequeno/sub/b.cs'), 'Pequeno');
  assert.equal(m.get('Grande/Naval/f1.cs'), 'Grande/Naval'); assert.equal(m.get('Grande/Models/f0.cs'), 'Grande/Models'); assert.equal(m.get('Grande/raiz.cs'), 'Grande/(arquivos)');
  // Sem subpastas não há como dividir: o módulo fica inteiro mesmo sendo grande.
  assert.equal(m.get('Plano/f3.cs'), 'Plano'); assert.equal(m.size, files.length);
});
test('changedSince e refreshProject: sem carimbo por arquivo não há atualização parcial; acima do limite também não', async t => {
  const { changedSince, refreshProject, PARTIAL_MAX } = await import('../src/project.mjs');
  const { root } = await fixture(t), code = { roots: ['src'] };
  for (let i = 0; i < 30; i++) await write(root, `src/f${i}.py`);
  await configure(root, code);
  const walked = (await walkCode(root, code)).files, stamp = f => f.size + ':' + Math.round(f.mtimeMs);
  const base = { schema: 1, files: walked.map(f => ({ file: f.rel, nucleo: 1, simbolos: ['S'], stamp: stamp(f) })), nucleos: [{ id: 1, rotulos: ['R'], pastas: ['src'], arquivos: walked.map(f => f.rel) }] };
  assert.deepEqual(changedSince(base, walked), { changed: [], removed: [] });
  assert.equal(changedSince({ ...base, files: base.files.map(({ stamp, ...f }) => f) }, walked), null);
  assert.equal(await refreshProject(root, code, { ...base, files: base.files.map(({ stamp, ...f }) => f) }), null);
  // Só remoções: não precisa do Graphify, e o índice sai sem os arquivos apagados.
  const fewer = { ...base, files: [...base.files, { file: 'src/sumiu.py', nucleo: 2, simbolos: [], stamp: '1:1' }], nucleos: [...base.nucleos, { id: 2, rotulos: [], pastas: ['src'], arquivos: ['src/sumiu.py'] }] };
  const r = await refreshProject(root, code, fewer);
  assert.equal(r.changed, 1); assert.equal(r.index.files.length, 30); assert.deepEqual(r.index.nucleos.map(n => n.id), [1]); assert.equal(r.index.drift, 1);
  // Mudança acumulada acima do limite pede reconstrução completa.
  assert.ok(PARTIAL_MAX < 1); assert.equal(await refreshProject(root, code, { ...fewer, drift: 20 }), null);
});
