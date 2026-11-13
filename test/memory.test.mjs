import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, symlink, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { claudeSlug, claudeMemoryDir, chunk, loadMemory, loadProject, recall, MIN_RELEVANCE } from '../src/memory.mjs';
import { fixture } from './helpers.mjs';
const key = 'fictional-test-credential';
const note = (name, description, body) => `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  type: project\n---\n${body}\n`;
async function folder(root, name, entries) {
  const dir = resolve(root, name); await mkdir(dir, { recursive: true });
  for (const [file, text] of Object.entries(entries)) { await mkdir(resolve(dir, file, '..'), { recursive: true }); await writeFile(resolve(dir, file), text); }
  return dir;
}
const reply = (answers, status = 200) => new Response(JSON.stringify({ answers, usage: { input_tokens: 7 } }), { status, headers: { 'content-type': 'application/json' } });
// Responde cada r<i> pelo marcador ALTO/MEDIO/QUASE/BAIXO nas instruções; sem marcador, 0.05.
function scripted({ calls = [], values = { ALTO: 0.9, MEDIO: 0.7, QUASE: 0.45, BAIXO: 0.1 } } = {}) {
  const request = async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const answers = {};
    for (const [k, q] of Object.entries(body.questions)) answers[k] = { type: 'noul', noul: Object.entries(values).find(([m]) => q.instructions.includes(m))?.[1] ?? 0.05 };
    return reply(answers);
  };
  return { request, calls };
}
const opts = (root, extra = {}) => ({ memoryDirs: [resolve(root, 'mem')], autoMemory: false, privacy: 'completo', ...extra });
test('claudeSlug troca tudo fora de [A-Za-z0-9] por hífen', () => {
  assert.equal(claudeSlug('C:\\Users\\ana\\Documents\\My_App'), 'C--Users-ana-Documents-My-App');
  assert.equal(claudeSlug('/home/joão/meu projeto'), '-home-jo-o-meu-projeto');
  assert.equal(claudeMemoryDir('/p/x', '/h'), resolve('/h', '.claude', 'projects', '-p-x', 'memory'));
});
test('chunk: divide por títulos e ignora títulos dentro de cerca ```', () => {
  const parts = chunk('intro\n# Um\ntexto um\n## Dois\ntexto dois\n```\n# não é título\n```\nfim', { merge: 5 });
  assert.deepEqual(parts.map(p => p.title), ['', 'Um', 'Dois']);
  assert.ok(parts[2].text.includes('# não é título') && parts[2].text.includes('fim'));
});
test('chunk: seções pequenas seguidas são unidas', () => {
  const parts = chunk('# A\nx\n# B\ny\n\n# C\nz');
  assert.equal(parts.length, 1); assert.equal(parts[0].title, 'A'); assert.ok(parts[0].text.includes('# C'));
});
test('chunk: seção longa é dividida em linhas em branco, parágrafo gigante é cortado', () => {
  const para = n => 'p'.repeat(n), text = '# T\n' + [para(60), para(60), para(60)].join('\n\n');
  const parts = chunk(text, { max: 100, merge: 50 });
  assert.ok(parts.length >= 3 && parts.every(p => p.text.length <= 100 && p.title === 'T'));
  const big = chunk('x'.repeat(250), { max: 100 });
  assert.deepEqual(big.map(p => p.text.length), [100, 100, 50]);
});
test('chunk: código tem títulos com intervalo de linhas e nada vazio sai', () => {
  const code = Array.from({ length: 10 }, (_, i) => 'linha' + i).join('\n');
  const parts = chunk(code, { code: true, max: 25 });
  assert.deepEqual(parts.map(p => p.title), ['linhas 1–3', 'linhas 4–6', 'linhas 7–9', 'linhas 10–10']);
  assert.ok(parts.every(p => p.text.length <= 25));
  assert.deepEqual(chunk('   \n\n  '), []); assert.deepEqual(chunk('', { code: true }), []);
  assert.ok(chunk('# a\n\n\n\n# b\n', { merge: 1 }).every(p => p.text.trim()));
});
test('loadMemory: frontmatter, MEMORY.md, um nível de subpasta, junction e duplicata', async t => {
  const { root } = await fixture(t);
  const dir = await folder(root, 'mem', { 'a.md': note('Nome A', 'Descrição A', '# Título\ncorpo a'), 'MEMORY.md': '- [a](a.md)', 'sub/MEMORY.md': 'x', 'sub/b.md': 'Sem frontmatter,   texto\nsimples.', 'sub/deep/c.md': 'fundo', 'nota.txt': 'não md' });
  const alvo = await folder(root, 'alvo', { 'z.md': 'ligada' });
  await symlink(alvo, resolve(dir, 'ligada'), 'junction');
  const r = await loadMemory(root, opts(root, { memoryDirs: [dir, dir] }));
  assert.equal(r.files, 2); assert.deepEqual(r.dirs, [await realpath(dir)]); assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.items.map(i => i.source), ['memory/a.md', 'memory/sub/b.md']);
  const [a, b] = r.items;
  assert.equal(a.name, 'Nome A'); assert.equal(a.description, 'Descrição A'); assert.equal(a.title, 'Título'); assert.equal(a.kind, 'memory'); assert.equal(a.part, 1); assert.equal(a.parts, 1);
  assert.equal(b.name, 'b'); assert.equal(b.description, 'Sem frontmatter, texto simples.'); assert.equal(b.title, 'b'); assert.match(a.id, /^[0-9a-f]{64}$/);
});
test('loadMemory: arquivo grande ou fora de UTF-8 vai para skipped', async t => {
  const { root } = await fixture(t);
  const dir = await folder(root, 'mem', { 'grande.md': 'x'.repeat(131073), 'latin.md': 'x', 'ok.md': 'tudo certo' });
  await writeFile(resolve(dir, 'latin.md'), Buffer.from([0xff, 0xfe, 0x41, 0xe9]));
  const r = await loadMemory(root, opts(root));
  assert.deepEqual(r.items.map(i => i.name), ['ok']); assert.equal(r.files, 1);
  assert.deepEqual(r.skipped.map(s => s.source).sort(), ['memory/grande.md', 'memory/latin.md']); assert.ok(r.skipped.every(s => s.reason.length <= 200));
});
test('loadMemory: memoryDirs relativo, inexistente ou arquivo é recusado', async t => {
  const { root } = await fixture(t);
  for (const bad of ['relativo/pasta', resolve(root, 'nao-existe'), resolve(root, 'policy.md')]) await assert.rejects(loadMemory(root, { memoryDirs: [bad], autoMemory: false }), /Invalid memory folder/);
});
test('loadMemory: acha a pasta automática do Claude por home injetada e respeita autoMemory false', async t => {
  const { root } = await fixture(t), real = await realpath(root), home = resolve(root, 'home');
  await folder(root, 'home/.claude/projects/' + claudeSlug(real) + '/memory', { 'x.md': note('auto', 'memória automática', 'conteúdo') });
  const on = await loadMemory(root, { home });
  assert.deepEqual(on.items.map(i => i.name), ['auto']); assert.equal(on.dirs.length, 1);
  const off = await loadMemory(root, { home, autoMemory: false }); assert.deepEqual(off.items, []); assert.deepEqual(off.dirs, []);
  assert.deepEqual((await loadMemory(root, { home: resolve(root, 'sem-home') })).items, []);
});
test('loadProject: trechos de policy.md e code.py; sem configuração, vazio', async t => {
  const { root } = await fixture(t);
  const r = await loadProject(root);
  assert.equal(r.files, 2); assert.deepEqual(r.items.map(i => i.source), ['policy.md', 'code.py']);
  assert.equal(r.items[0].kind, 'project'); assert.equal(r.items[0].title, 'Faturas'); assert.match(r.items[0].text, /Aurora/); assert.equal(r.items[1].title, 'linhas 1–3');
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: ['../fora.md'], skills: [] }));
  await assert.rejects(loadProject(root), /Invalid or private relative path/);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: ['a.bin'], skills: [] }));
  await assert.rejects(loadProject(root), /Unsupported file type: a\.bin/);
  const vazio = await fixture(t); await writeFile(resolve(vazio.root, '.jev-graphify.json'), '{}');
  const { rm } = await import('node:fs/promises'); await rm(resolve(vazio.root, '.jev-graphify.json'));
  assert.deepEqual(await loadProject(vazio.root), { items: [], files: 0 });
});
test('consulta, teto e privacidade inválidos são recusados', async t => {
  const { root } = await fixture(t);
  for (const bad of ['', '  ', 'x'.repeat(4001), 5]) await assert.rejects(recall(root, bad, opts(root)), /Invalid query \(1–4000 characters\)\./);
  for (const bad of [199, 8001, 1.5, '1500']) await assert.rejects(recall(root, 'a', opts(root, { budget: bad })), /Invalid token budget \(200–8000\)\./);
  await assert.rejects(recall(root, 'a', opts(root, { privacy: 'x' })), /Invalid privacy: use completo or ficha\./);
});
test('recall sem chave: ranking local, nenhuma requisição, dentro do teto', async t => {
  const { root } = await fixture(t); let calls = 0;
  await folder(root, 'mem', { 'a.md': note('cores', 'Paleta de cores', 'azul e verde'), 'b.md': note('zephyr', 'Regra zephyr de arredondamento', 'zephyr arredonda para cima') });
  const r = await recall(root, 'regra zephyr', opts(root, { request: async () => { calls++; }, budget: 300 }));
  assert.equal(r.status, 'local'); assert.equal(r.reason, 'no_key'); assert.equal(r.requests, 0); assert.equal(calls, 0);
  assert.equal(r.items[0].source, 'memory/b.md'); assert.ok(r.returned_tokens_estimate <= 300);
  assert.equal(r.corpus.files, 4); assert.ok(r.corpus.items >= 4 && r.corpus.tokens_estimate > 0); assert.equal(r.trust, 'untrusted_project_data');
  assert.equal((await recall(root, 'regra', opts(root, { key, jev: false, request: async () => { calls++; } }))).reason, 'turned_off'); assert.equal(calls, 0);
});
test('recall vazio', async t => {
  const { root } = await fixture(t);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [] }));
  const r = await recall(root, 'algo', { autoMemory: false });
  assert.equal(r.status, 'empty'); assert.equal(r.corpus.items, 0); assert.match(r.note, /--memory-dir/);
});
test('recall com Jev: ordena por relevância e descarta o que está abaixo do mínimo', async t => {
  const { root } = await fixture(t), calls = [];
  await folder(root, 'mem', { 'a.md': 'MEDIO texto a', 'b.md': 'ALTO texto b', 'c.md': 'BAIXO texto c', 'd.md': 'QUASE texto d' });
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted({ calls }).request }));
  assert.equal(r.status, 'ok'); assert.equal(r.requests, 1); assert.equal(calls.length, 1); assert.deepEqual(calls[0].state, { request: 'tarefa' });
  assert.deepEqual(r.items.map(i => i.source), ['memory/b.md', 'memory/a.md']); assert.deepEqual(r.items.map(i => i.relevance), [0.9, 0.7]);
  // O que fica entre os dois cortes vem só como ponteiro, sem texto.
  assert.deepEqual(r.near, [{ kind: 'memory', source: 'memory/d.md', title: 'd', relevance: 0.45 }]);
  assert.ok(r.items.every(i => i.relevance >= MIN_RELEVANCE)); assert.equal(r.usage.input_tokens, 7); assert.equal(r.omitted, 0);
  assert.ok(Object.keys(calls[0].questions).every(k => /^r\d+$/.test(k) && calls[0].questions[k].type === 'noul'));
});
test('recall com Jev: tudo abaixo do mínimo dá none com near sem texto', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', { 'a.md': 'QUASE a', 'b.md': 'BAIXO b', 'c.md': 'c' });
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted().request }));
  assert.equal(r.status, 'none'); assert.deepEqual(r.items, []); assert.deepEqual(r.near.map(n => n.source), ['memory/a.md']);
  assert.ok(r.near.every(n => n.text === undefined && n.source && n.relevance < MIN_RELEVANCE));
});
test('recall: teto mínimo corta o primeiro trecho e conta o resto como omitido', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', { 'a.md': 'ALTO ' + 'a'.repeat(1500), 'b.md': 'ALTO ' + 'b'.repeat(1500) });
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted().request, budget: 200 }));
  assert.equal(r.items.length, 1); assert.equal(r.items[0].truncated, true); assert.equal(r.items[0].text.length, 700); assert.equal(r.omitted, 1); assert.ok(r.returned_tokens_estimate <= 200);
});
test('recall: segundo trecho que não cabe é pulado e o seguinte que cabe entra', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', { 'a.md': 'ALTO ' + 'a'.repeat(400), 'b.md': 'MEDIO ' + 'b'.repeat(900), 'c.md': 'MEDIO curto' });
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted().request, budget: 200 }));
  assert.deepEqual(r.items.map(i => i.source), ['memory/a.md', 'memory/c.md']); assert.equal(r.omitted, 1); assert.ok(r.items.every(i => !i.truncated));
});
test('recall: 700 arquivos viram várias requisições de até 300 perguntas', async t => {
  const { root } = await fixture(t), calls = [], many = {};
  for (let i = 0; i < 700; i++) many['m' + String(i).padStart(3, '0') + '.md'] = i === 5 ? 'ALTO achado' : 'texto ' + i;
  await folder(root, 'mem', many);
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted({ calls }).request }));
  assert.ok(r.requests >= 3 && calls.length === r.requests); assert.ok(calls.every(c => Object.keys(c.questions).length <= 300));
  assert.equal(Object.values(calls).reduce((n, c) => n + Object.keys(c.questions).length, 0), r.corpus.items);
  assert.equal(r.status, 'ok'); assert.equal(r.items[0].source, 'memory/m005.md');
});
test('recall: ficha nunca envia o texto; completo envia', async t => {
  const { root } = await fixture(t), marker = 'MARCADOR_UNICO_ZQX_81';
  await folder(root, 'mem', { 'a.md': note('segredo', 'Descrição pública da nota', 'ALTO ' + marker) });
  const bodies = [], request = async (u, o) => { bodies.push(o.body); return scripted().request(u, o); };
  const ficha = await recall(root, 'tarefa', opts(root, { key, request, privacy: 'ficha' }));
  assert.equal(ficha.privacy, 'ficha'); assert.ok(bodies.length && bodies.every(b => !b.includes(marker) && !b.includes(key)));
  assert.ok(bodies.every(b => b.includes('Descrição pública da nota')));
  bodies.length = 0;
  await recall(root, 'tarefa', opts(root, { key, request }));
  assert.ok(bodies.some(b => b.includes(marker)));
});
test('recall: HTTP 500 dá unavailable mas devolve trechos do ranking local', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', { 'a.md': note('zephyr', 'Regra zephyr', 'zephyr arredonda') });
  const r = await recall(root, 'regra zephyr', opts(root, { key, request: async () => new Response('segredo do servidor', { status: 500 }) }));
  assert.equal(r.status, 'unavailable'); assert.equal(r.http, 500); assert.ok(r.items.length >= 1); assert.equal(r.items[0].source, 'memory/a.md'); assert.ok(!JSON.stringify(r).includes('segredo do servidor'));
});
test('recall: resposta incompleta cai no ranking local como invalid', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', { 'a.md': note('zephyr', 'Regra zephyr', 'zephyr arredonda') });
  const r = await recall(root, 'Aurora', opts(root, { key, request: async () => reply({}) }));
  assert.equal(r.status, 'invalid'); assert.ok(r.items.length >= 1);
});
test('recall: o registro de envio guarda só contagens, com purpose recall', async t => {
  const { root } = await fixture(t), marker = 'TEXTO_SECRETO_DA_NOTA';
  await folder(root, 'mem', { 'a.md': 'ALTO ' + marker });
  await recall(root, 'Pedido sigiloso', opts(root, { key, request: scripted().request }));
  const log = await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8'), lines = log.trim().split('\n').map(l => JSON.parse(l));
  assert.ok(lines.length >= 1 && lines.every(l => l.purpose === 'recall' && l.bytes > 0 && l.status === 'ok'));
  assert.ok(log.includes('"purpose":"recall"') && !log.includes(marker) && !log.includes('Pedido sigiloso') && !log.includes(key));
});
test('recall: arquivos ignorados aparecem em skipped', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', { 'grande.md': 'x'.repeat(131073), 'ok.md': 'Aurora' });
  const r = await recall(root, 'Aurora', opts(root));
  assert.deepEqual(r.skipped.map(s => s.source), ['memory/grande.md']);
});
// Corpus grande (acima de FULL_SCAN_CHARS): 40 memórias de ~1900 caracteres; m03 e m17 têm ALTO na descrição e no corpo, m25 só no corpo.
const BODY_ONLY = 'CORPO_UNICO_QWX_55';
async function big(root) {
  const many = {}, filler = 'palavra '.repeat(238);
  for (let i = 0; i < 40; i++) {
    const id = 'm' + String(i).padStart(2, '0'), hit = i === 3 || i === 17;
    many[id + '.md'] = note(id, hit ? 'ALTO zephyr regra ' + id : 'Nota genérica ' + id, (hit ? 'ALTO zephyr ' : i === 25 ? 'ALTO ' + BODY_ONLY + ' ' : '') + filler);
  }
  return folder(root, 'mem', many);
}
const qnames = c => Object.keys(c.questions);
test('recall: corpus pequeno em completo usa strategy full, uma requisição e só perguntas r*', async t => {
  const { root } = await fixture(t), calls = [];
  await folder(root, 'mem', { 'a.md': 'ALTO texto a', 'b.md': 'BAIXO texto b' });
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted({ calls }).request }));
  assert.equal(r.strategy, 'full'); assert.equal(r.requests, 1); assert.equal(calls.length, 1);
  assert.ok(qnames(calls[0]).every(k => /^r\d+$/.test(k))); assert.equal(r.stages, undefined); assert.deepEqual(r.related, []);
});
test('recall: corpus grande usa cartas por arquivo e texto só dos melhores', async t => {
  const { root } = await fixture(t), calls = [];
  await big(root);
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted({ calls }).request }));
  assert.equal(r.strategy, 'cards'); assert.equal(r.status, 'ok'); assert.equal(r.requests, 2); assert.equal(calls.length, 2);
  assert.ok(qnames(calls[0]).every(k => /^f\d+$/.test(k))); assert.equal(qnames(calls[0]).length, 42);
  assert.ok(!JSON.stringify(calls[0]).includes(BODY_ONLY) && !JSON.stringify(calls[0]).includes('palavra palavra'));
  assert.ok(qnames(calls[1]).every(k => /^r\d+$/.test(k))); assert.equal(qnames(calls[1]).length, 12);
  assert.deepEqual(r.items.map(i => i.source), ['memory/m03.md', 'memory/m17.md']);
  assert.equal(r.stages.cards.files, 42); assert.equal(r.stages.cards.shortlisted, 12); assert.equal(r.stages.text.items, 12);
  assert.deepEqual(r.stages.cards.ranking.slice(0, 3), [{ source: 'memory/m03.md', relevance: 0.9 }, { source: 'memory/m17.md', relevance: 0.9 }, { source: 'code.py', relevance: 0.05 }]);
  assert.equal(r.usage.input_tokens, 14);
  const small = await recall(root, 'tarefa', opts(root, { key, request: scripted({ calls: [] }).request, topFiles: 3 }));
  assert.equal(small.stages.cards.shortlisted, 3); assert.equal(small.stages.text.items, 3); assert.deepEqual(small.items.map(i => i.source), ['memory/m03.md', 'memory/m17.md']);
});
test('recall: ALTO só no corpo fica de fora do top e entra com topFiles grande (trade-off conhecido)', async t => {
  const { root } = await fixture(t);
  await big(root);
  const miss = await recall(root, 'tarefa', opts(root, { key, request: scripted().request }));
  assert.ok(!miss.items.some(i => i.source === 'memory/m25.md'));
  const hit = await recall(root, 'tarefa', opts(root, { key, request: scripted().request, topFiles: 50, budget: 4000 }));
  assert.equal(hit.stages.text.items, 42); assert.deepEqual(hit.items.map(i => i.source), ['memory/m03.md', 'memory/m17.md', 'memory/m25.md']);
  // deep lê o acervo inteiro, sem etapa de fichas, e também acha o detalhe que só está no corpo.
  const deep = await recall(root, 'tarefa', opts(root, { key, request: scripted().request, deep: true, budget: 4000 }));
  assert.equal(deep.strategy, 'full'); assert.equal(deep.stages, undefined); assert.ok(deep.items.some(i => i.source === 'memory/m25.md'));
  await assert.rejects(recall(root, 'tarefa', opts(root, { deep: 'sim' })), /Invalid deep option/);
});
test('recall: ficha usa só cartas, nunca envia corpo e ordena por arquivo e parte', async t => {
  const { root } = await fixture(t), bodies = [], marker = 'MARCADOR_FICHA_ZQX';
  const body = '# Um\ntexto um ' + marker + '\n# Dois\n' + 'y'.repeat(1600);
  await folder(root, 'mem', { 'a.md': note('alfa', 'MEDIO descrição alfa', body), 'b.md': note('beta', 'ALTO descrição beta', body), 'c.md': note('gama', 'QUASE descrição gama', body) });
  const request = async (u, o) => { bodies.push(o.body); return scripted().request(u, o); };
  const r = await recall(root, 'tarefa', opts(root, { key, request, privacy: 'ficha', budget: 8000 }));
  assert.equal(r.strategy, 'cards'); assert.equal(r.status, 'ok'); assert.equal(r.stages.text.items, 0);
  assert.ok(bodies.length === 1 && bodies.every(b => !b.includes(marker) && !b.includes('yyyy')));
  assert.deepEqual(r.items.map(i => [i.source, i.part, i.relevance]), [['memory/b.md', 1, 0.9], ['memory/b.md', 2, 0.9], ['memory/a.md', 1, 0.7], ['memory/a.md', 2, 0.7]]);
  assert.deepEqual(r.near, [{ kind: 'memory', source: 'memory/c.md', title: 'gama', relevance: 0.45 }]);
});
test('recall: falha na fase 1 ou na fase 2 dá unavailable com ranking local', async t => {
  const { root } = await fixture(t);
  await big(root);
  const down = async () => new Response('x', { status: 500 });
  const a = await recall(root, 'zephyr', opts(root, { key, request: down }));
  assert.equal(a.status, 'unavailable'); assert.equal(a.http, 500); assert.equal(a.strategy, 'cards'); assert.ok(a.items.length >= 1);
  let n = 0;
  const half = (u, o) => ++n === 1 ? scripted().request(u, o) : down();
  const b = await recall(root, 'zephyr', opts(root, { key, request: half }));
  assert.equal(b.status, 'unavailable'); assert.equal(b.http, 500); assert.equal(b.strategy, 'cards'); assert.ok(b.items.length >= 1); assert.equal(b.requests, 2);
});
test('recall: topFiles inválido é recusado', async t => {
  const { root } = await fixture(t);
  for (const bad of [0, 51, 2.5, '3']) await assert.rejects(recall(root, 'a', opts(root, { topFiles: bad })), /Invalid number of files \(1–50\)\./);
});
test('recall: related aponta memórias ligadas por [[nome]] que não foram devolvidas', async t => {
  const { root } = await fixture(t);
  await folder(root, 'mem', {
    'a.md': note('a', 'x', 'ALTO veja [[Outra-Memoria]], [[ja-devolvida]], [[desconhecida]] e de novo [[outra-memoria]]'),
    'outra.md': note('outra-memoria', 'y', 'BAIXO fim'), 'dev.md': note('ja-devolvida', 'z', 'ALTO devolvida'),
  });
  const r = await recall(root, 'tarefa', opts(root, { key, request: scripted().request }));
  assert.deepEqual(r.items.map(i => i.source), ['memory/a.md', 'memory/dev.md']);
  assert.deepEqual(r.related, [{ kind: 'memory', source: 'memory/outra.md', title: 'outra-memoria' }]);
  const none = await recall(root, 'tarefa', opts(root, { key, jev: false }));
  assert.ok(Array.isArray(none.related)); assert.equal(none.strategy, 'local');
});
test('recall: o registro de envio das cartas tem purpose recall_cards', async t => {
  const { root } = await fixture(t);
  await big(root);
  await recall(root, 'tarefa', opts(root, { key, request: scripted().request }));
  const log = await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8'), lines = log.trim().split('\n').map(l => JSON.parse(l));
  assert.ok(lines.some(l => l.purpose === 'recall_cards') && lines.some(l => l.purpose === 'recall') && !log.includes(BODY_ONLY));
});
