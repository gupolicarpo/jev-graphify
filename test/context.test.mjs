import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fixture } from './helpers.mjs';
import { hash, atomicJson } from '../src/files.mjs';
import { walkCode, fingerprint } from '../src/project.mjs';
import { contextPack, splitSections, outline, MAX_CONTEXT } from '../src/context.mjs';
import { optionsFromEnv } from '../src/env.mjs';
const key = 'fictional-test-credential';
const query = 'please fix the rounding rule in the billing HOTSPOT code';
const reply = answers => new Response(JSON.stringify({ answers, usage: { input_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
// Marca HOTSPOT nas instruções = relevante (0.9); pergunta de seção sem a marca = 0.59 (abaixo do corte); o resto = 0.05.
function fake(calls = []) {
  return async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const answers = {};
    for (const [k, q] of Object.entries(body.questions)) answers[k] = { type: 'noul', noul: q.instructions.includes('HOTSPOT') ? 0.9 : q.instructions.startsWith('Does this excerpt') ? 0.59 : 0.05 };
    return reply(answers);
  };
}
const sectionCalls = calls => calls.filter(b => Object.values(b.questions).some(q => q.instructions.startsWith('Does this excerpt')));
const bodyLines = (k, hot, n = 40) => {
  const lines = ['def block_' + k + '():'];
  if (hot) lines.push('    # HOTSPOT_marker');
  for (let j = lines.length; j < n; j++) lines.push('    value_' + k + '_' + j + ' = compute_total(' + j + ') + 12345');
  return lines;
};
// 41 linhas por bloco (40 + linha em branco): o bloco b ocupa as linhas b*41+1 .. b*41+41.
const makeCode = (blocks, hot, n = 40) => Array.from({ length: blocks }, (_, b) => bodyLines(b, hot.includes(b), n).join('\n') + '\n').join('\n');
async function project(t, { blocks = 10, hot = [3], configured = true, memory, blockLen = 40 } = {}) {
  const { root } = await fixture(t);
  const code = makeCode(blocks, hot, blockLen);
  if (memory) await writeFile(resolve(root, 'policy.md'), memory);
  if (!configured) return { root, code };
  await mkdir(resolve(root, 'src'), { recursive: true });
  await writeFile(resolve(root, 'src/billing.py'), code);
  await writeFile(resolve(root, 'src/other.py'), 'def other():\n    return 2\n');
  const config = JSON.parse(await readFile(resolve(root, '.jev-graphify.json'), 'utf8'));
  const cfg = { roots: ['src'] };
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, code: cfg }));
  const { files: walked } = await walkCode(root, cfg);
  const stamp = rel => { const f = walked.find(w => w.rel === rel); return f.size + ':' + Math.round(f.mtimeMs); };
  const files = [{ file: 'src/billing.py', nucleo: 0, simbolos: ['HOTSPOT_rule'], stamp: stamp('src/billing.py') }, { file: 'src/other.py', nucleo: 1, simbolos: ['other'], stamp: stamp('src/other.py') }];
  const nucleos = [{ id: 0, rotulos: [], pastas: ['src'], arquivos: ['src/billing.py'] }, { id: 1, rotulos: [], pastas: ['src'], arquivos: ['src/other.py'] }];
  await atomicJson(root, '.jev-graphify/project.json', { schema: 1, project: hash(await realpath(root)), generatedAt: '2026-01-01T00:00:00Z', fingerprint: fingerprint(walked), graphify: { version: '0.9.107', nodes: 1, edges: 0, communities: 2 }, files, nucleos });
  return { root, code };
}
const renderedLines = (text, file, from) => {
  const head = text.indexOf('### ' + file + ' lines ' + from + '-'), out = [];
  for (const l of text.slice(head).split('\n').slice(2)) { const m = l.match(/^\s*(\d+)\| (.*)$/); if (!m) break; out.push([Number(m[1]), m[2]]); }
  return out;
};
test('regras de skip: prompt curto, poucas palavras, barra e sem índice', async t => {
  const { root } = await project(t);
  const options = { key, request: fake(), memoryDirs: [] };
  for (const p of ['', 'oi', 'two words only', 'a b c', '/compact the conversation please now', undefined]) assert.equal((await contextPack(root, p, options)).status, 'skip', String(p));
  const bare = await project(t, { configured: false });
  const r = await contextPack(bare.root, query, options);
  assert.equal(r.status, 'no_index'); assert.equal(r.text, '');
});
test('ficha: nenhuma linha de corpo vai ao serviço, só declarações e identificadores', async t => {
  const { root, code } = await project(t);
  const calls = [];
  const r = await contextPack(root, query, { key, request: fake(calls), privacy: 'ficha' });
  assert.equal(r.status, 'ok'); assert.equal(r.strategy, 'jev');
  const sent = sectionCalls(calls); assert.ok(sent.length);
  const payload = sent.flatMap(b => Object.values(b.questions).map(q => q.instructions)).join('\n');
  assert.match(payload, /Declarations: def block_\d/); assert.match(payload, /Identifiers: /);
  for (const line of code.split('\n').map(l => l.trim()).filter(l => l.length > 12 && !/^def /.test(l))) assert.ok(!payload.includes(line), 'vazou: ' + line);
});
test('completo envia o texto das seções', async t => {
  const { root } = await project(t);
  const calls = [];
  await contextPack(root, query, { key, request: fake(calls), privacy: 'completo', contextMode: 'full' });
  const payload = sectionCalls(calls).flatMap(b => Object.values(b.questions).map(q => q.instructions)).join('\n');
  assert.ok(payload.includes('value_3_5 = compute_total(5) + 12345'));
  assert.ok(payload.includes('File: src/billing.py lines 124-164'));
});
test('seleção: só acima do corte; números de linha corretos; confiança alta', async t => {
  const { root, code } = await project(t, { hot: [3, 7] });
  const r = await contextPack(root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full' });
  assert.equal(r.status, 'ok'); assert.equal(r.confidence, 'high');
  assert.deepEqual(r.stats.snippets.map(s => [s.from, s.to]).sort((a, b) => a[0] - b[0]), [[124, 164], [288, 328]]);
  assert.match(r.text, /^<jev-graphify-context confidence="high">/); assert.match(r.text, /<\/jev-graphify-context>$/);
  const real = code.split('\n');
  for (const [from] of [[124], [288]]) {
    const lines = renderedLines(r.text, 'src/billing.py', from); assert.equal(lines.length, 41);
    for (const [n, l] of lines) assert.equal(l, real[n - 1]);
  }
  assert.equal(r.stats.injectedChars, r.text.length);
});
test('seleção: seções vizinhas viram um trecho e o teto é de 4000 caracteres de código', async t => {
  const adj = await project(t, { hot: [4, 5] });
  const a = await contextPack(adj.root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full' });
  assert.deepEqual(a.stats.snippets.map(s => [s.from, s.to]), [[165, 246]]);
  const many = await project(t, { blocks: 12, hot: Array.from({ length: 12 }, (_, i) => i) });
  const m = await contextPack(many.root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full' });
  assert.equal(m.stats.snippets.length, 1);
  assert.equal(m.stats.snippets[0].to - m.stats.snippets[0].from + 1, 2 * 41);
});
test('confiança baixa: sem seção relevante omite o código e mantém arquivos prováveis', async t => {
  const { root } = await project(t, { hot: [] });
  const request = async (_, options) => {
    const body = JSON.parse(options.body), answers = {};
    for (const [k, q] of Object.entries(body.questions)) answers[k] = { type: 'noul', noul: q.instructions.startsWith('Does this excerpt') ? 0.05 : 0.9 };
    return reply(answers);
  };
  const r = await contextPack(root, query, { key, request, privacy: 'completo', contextMode: 'full' });
  assert.equal(r.status, 'ok'); assert.equal(r.confidence, 'low');
  assert.ok(!r.text.includes('## Code')); assert.match(r.text, /Low confidence/); assert.match(r.text, /## File outlines \(declarations and line numbers\)\n- src\/billing\.py: L1 def block_0\(\):/); assert.ok(!r.text.includes('## Other likely files'));
});
test('notas da memória entram no texto', async t => {
  const { root } = await project(t, { memory: '# Regra\nA regra HOTSPOT usa ROUND_HALF_UP para arredondar.' });
  const r = await contextPack(root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full' });
  assert.ok(r.stats.notes >= 1); assert.match(r.text, /## Notes and decisions/); assert.match(r.text, /ROUND_HALF_UP/);
});
test('falha do Jev e Jev desligado caem na pontuação local', async t => {
  const { root } = await project(t);
  const down = async () => new Response('x', { status: 500 });
  for (const options of [{ key, request: down }, { jev: false }, { key }]) {
    const r = await contextPack(root, query, { ...options, privacy: 'completo', contextMode: 'full' });
    assert.equal(r.status, 'ok'); assert.equal(r.strategy, 'local'); assert.equal(r.confidence, 'high');
    assert.deepEqual(r.stats.snippets.map(s => [s.from, s.to]), [[124, 164]]);
  }
});
// Pontua cada seção pelo intervalo de linhas no texto completo: byFrom = { 'src/billing.py': { 83: 0.55 } }; o resto das seções = 0.05; perguntas que não são de seção = 0.9.
function scoredBy(byFrom) {
  return async (_, options) => {
    const body = JSON.parse(options.body), answers = {};
    for (const [k, q] of Object.entries(body.questions)) {
      const m = q.instructions.match(/File: (\S+) lines (\d+)-/);
      answers[k] = { type: 'noul', noul: !q.instructions.startsWith('Does this excerpt') ? 0.9 : byFrom[m?.[1]]?.[m?.[2]] ?? 0.05 };
    }
    return reply(answers);
  };
}
test('corte relativo: 0.55/0.50 entram, 0.30 não', async t => {
  const { root } = await project(t);
  const r = await contextPack(root, query, { key, request: scoredBy({ 'src/billing.py': { 83: 0.55, 206: 0.50, 288: 0.30 } }), privacy: 'completo', contextMode: 'full' });
  assert.equal(r.strategy, 'jev');
  assert.deepEqual(r.stats.snippets.map(s => [s.file, s.from]).sort((a, b) => a[1] - b[1]), [['src/billing.py', 83], ['src/billing.py', 206]]);
  assert.equal(r.confidence, 'high');
});
test('corte relativo: o piso 0.40 vale quando a melhor é baixa; confiança média abaixo de 0.55', async t => {
  const { root } = await project(t);
  const r = await contextPack(root, query, { key, request: scoredBy({ 'src/billing.py': { 83: 0.45, 206: 0.42, 288: 0.38 } }), privacy: 'completo', contextMode: 'full' });
  assert.deepEqual(r.stats.snippets.map(s => s.from).sort((a, b) => a - b), [83, 206]);
  assert.equal(r.confidence, 'medium');
});
test('a melhor seção de cada um dos dois primeiros arquivos entra se passar do piso', async t => {
  const { root } = await project(t);
  const r = await contextPack(root, query, { key, request: scoredBy({ 'src/billing.py': { 83: 0.80 }, 'src/other.py': { 1: 0.45 } }), privacy: 'completo', contextMode: 'full' });
  assert.deepEqual(r.stats.snippets.map(s => [s.file, s.from]).sort((a, b) => a[0] < b[0] ? -1 : 1), [['src/billing.py', 83], ['src/other.py', 1]]);
  const low = await contextPack(root, query, { key, request: scoredBy({ 'src/billing.py': { 83: 0.80 }, 'src/other.py': { 1: 0.35 } }), privacy: 'completo', contextMode: 'full' });
  assert.deepEqual(low.stats.snippets.map(s => s.file), ['src/billing.py']);
});
test('outline: declarações com número de linha, sem atribuições, sem ponto e vírgula, máximo 40', () => {
  const content = ['using System;', 'public class Foo {', '    public int Total = 5;', '    private void Run() {', '        x = 1;', '    }', '    static int Count;', '    async function go() {}', 'def py_fn(a):', '    value = compute()', 'const y = 1', 'export const z = () => 1', 'let w = 3'].join('\r\n');
  assert.deepEqual(outline(content), [{ line: 2, text: 'public class Foo' }, { line: 4, text: 'private void Run()' }, { line: 8, text: 'async function go() {}' }, { line: 9, text: 'def py_fn(a):' }]);
  assert.equal(outline(Array.from({ length: 100 }, (_, i) => 'def f' + i + '():').join('\n')).length, 40);
  assert.deepEqual(outline('x'.repeat(10) + '\nclass ' + 'a'.repeat(200)), []);
});
test('texto traz o índice de declarações com linhas corretas e não repete esses arquivos em Other likely files', async t => {
  const { root, code } = await project(t, { hot: [3] });
  const r = await contextPack(root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full' });
  assert.match(r.text, /## File outlines \(declarations and line numbers\)\n- src\/billing\.py: L1 def block_0\(\): · L42 def block_1\(\):/);
  assert.ok(r.text.indexOf('## Code excerpts') < r.text.indexOf('## File outlines'));
  assert.match(r.text, /## Code excerpts/);
  const real = code.split('\n');
  for (let b = 0; b < 10; b++) { const n = b * 41 + 1; assert.equal(real[n - 1], 'def block_' + b + '():'); assert.ok(r.text.includes(' L' + n + ' def block_' + b + '():'), 'L' + n); }
  assert.ok(!r.text.includes('## Other likely files'));
});
test('índice em uma linha por arquivo: modificadores removidos, itens cortados em 70 caracteres', async t => {
  const { root } = await project(t, { hot: [3] });
  const lines = ['public static class Svc {', '    private async Task Run(int a) {', '        x = 1;', '    }', '    public void ' + 'N'.repeat(100) + '() {', '    }'];
  await writeFile(resolve(root, 'src/other.py'), lines.join('\n') + '\n');
  const r = await contextPack(root, query, { key, request: scoredBy({}), privacy: 'completo', contextMode: 'full' });
  const row = r.text.split('\n').find(l => l.startsWith('- src/other.py: '));
  assert.ok(row, r.text);
  const items = row.slice('- src/other.py: '.length).split(' · ');
  assert.equal(items[0], 'L1 class Svc'); assert.equal(items[1], 'L2 Task Run(int a)');
  assert.equal(items[2], 'L5 void ' + 'N'.repeat(70 - 'void '.length));
  assert.equal(items.length, 3);
  assert.ok(!/(^| )(public|private|static) /.test(row.slice('- src/other.py: '.length)));
});
test('pacote enorme: no máximo MAX_CONTEXT caracteres e termina com a tag de fechamento', async t => {
  const long = Array.from({ length: 8 }, (_, i) => '# Seção ' + i + '\nHOTSPOT ' + String.fromCharCode(97 + i).repeat(1700)).join('\n');
  const { root } = await project(t, { hot: Array.from({ length: 10 }, (_, i) => i), memory: long });
  await mkdir(resolve(root, 'mem'), { recursive: true });
  for (let i = 0; i < 4; i++) await writeFile(resolve(root, 'mem/n' + i + '.md'), '# Nota ' + i + '\nHOTSPOT ' + 'z'.repeat(3000));
  for (const f of ['big1.py', 'big2.py']) await writeFile(resolve(root, 'src/' + f), makeCode(30, [0, 1, 2, 3, 4, 5, 6, 7]));
  const r = await contextPack(root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full', memoryDirs: [resolve(root, 'mem')] });
  assert.equal(r.status, 'ok');
  assert.ok(r.text.length <= MAX_CONTEXT, String(r.text.length)); assert.ok(r.text.length > 4000);
  assert.ok(r.text.endsWith('</jev-graphify-context>'));
  assert.equal(r.stats.injectedChars, r.text.length);
});
test('nota longa é cortada com o marcador e o caminho da nota completa', async t => {
  const { root } = await project(t, { memory: '# Longa\nHOTSPOT ' + 'palavra '.repeat(400) });
  const r = await contextPack(root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full', memoryDirs: [] });
  const m = r.text.match(/ \[\.\.\.\] \(full note: ([^)]+)\)/);
  assert.ok(m, r.text.slice(0, 600)); assert.ok(m[1].includes('policy.md'));
  assert.ok(!r.text.includes('palavra '.repeat(300)));
});
test('notas: no máximo 2 trechos por origem e a segunda nota ainda aparece', async t => {
  const long = Array.from({ length: 5 }, (_, i) => '# Seção ' + i + '\nHOTSPOT ' + String.fromCharCode(97 + i).repeat(1600)).join('\n');
  const { root } = await project(t, { memory: long });
  await mkdir(resolve(root, 'mem'), { recursive: true });
  await writeFile(resolve(root, 'mem/extra.md'), '# Extra\nHOTSPOT nota curta sobre arredondamento.');
  const r = await contextPack(root, query, { key, request: fake(), privacy: 'completo', contextMode: 'full', memoryDirs: [resolve(root, 'mem')] });
  assert.equal(r.status, 'ok');
  const sources = [...r.text.matchAll(/^### .* \((\S+\.md)\)$/gm)].map(m => m[1]);
  assert.equal(sources.filter(s => s === 'policy.md').length, 2, sources.join(','));
  assert.ok(sources.some(s => s.endsWith('extra.md')), sources.join(','));
  assert.equal(r.stats.notes, sources.length);
});
test('splitSections: fecha em linha em branco ou chave depois de 900 caracteres', () => {
  const line = 'x'.repeat(49), body = Array(20).fill(line);
  const s = splitSections('a.cs', [...body, '}', ...body, '', ...body].join('\n'));
  assert.deepEqual(s.map(x => [x.from, x.to]), [[1, 21], [22, 42], [43, 62]]);
  const long = splitSections('b.txt', Array(100).fill('x'.repeat(99)).join('\n'));
  assert.ok(long.every(x => x.text.length <= 1900)); assert.equal(long[0].from, 1);
});
test('optionsFromEnv: validações e JEV_GRAPHIFY_AUTO_MEMORY=0', () => {
  const abs = process.cwd();
  assert.equal(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs }).options.autoMemory, true);
  assert.equal(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs, JEV_GRAPHIFY_AUTO_MEMORY: '0' }).options.autoMemory, false);
  assert.equal(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs }, ['--no-auto-memory']).options.autoMemory, false);
  assert.ok(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: 'rel' }).error);
  assert.ok(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs }, ['--bogus']).error);
  assert.ok(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs, JEV_GRAPHIFY_PRIVACY: 'x' }).error);
  assert.ok(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs, JEV_GRAPHIFY_DAILY_TOKENS: '-1' }).error);
});
function runHook(input, extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('JEV_') && k !== 'CLAUDE_PROJECT_DIR'));
  return spawnSync(process.execPath, [resolve('src/hook.mjs')], { input, env: { ...env, ...extra }, encoding: 'utf8', timeout: 60000 });
}
test('hook.mjs: stdin JSON vira additionalContext e uma linha em hook.jsonl, sem texto do prompt', async t => {
  const { root } = await project(t);
  const r = runHook(JSON.stringify({ prompt: query, cwd: root, session_id: 's1', hook_event_name: 'UserPromptSubmit' }), { JEV_GRAPHIFY_AUTO_MEMORY: '0' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(out), ['hookSpecificOutput']); assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /^<jev-graphify-context confidence="/);
  const raw = await readFile(resolve(root, '.jev-graphify/hook.jsonl'), 'utf8'), lines = raw.trim().split('\n');
  assert.equal(lines.length, 1);
  const log = JSON.parse(lines[0]);
  assert.equal(log.status, 'ok'); assert.equal(log.promptHash, hash(query)); assert.equal(log.promptChars, query.length); assert.ok(log.injectedChars > 0);
  assert.ok(!raw.includes('rounding rule'));
});
test('hook.mjs: sem índice, entrada inválida ou desligado saem com 0 e sem saída', async t => {
  const { root } = await project(t, { configured: false });
  const r = runHook(JSON.stringify({ prompt: query, cwd: root }), { JEV_GRAPHIFY_AUTO_MEMORY: '0' });
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
  const log = JSON.parse((await readFile(resolve(root, '.jev-graphify/hook.jsonl'), 'utf8')).trim());
  assert.equal(log.status, 'no_index');
  const bad = runHook('not json'); assert.equal(bad.status, 0); assert.equal(bad.stdout, ''); assert.equal(bad.stderr, '');
  const off = runHook(JSON.stringify({ prompt: query, cwd: root }), { JEV_GRAPHIFY_HOOK: '0' }); assert.equal(off.status, 0); assert.equal(off.stdout, '');
});
const compactOpts = extra => ({ key, privacy: 'completo', memoryDirs: [], ...extra });
test('compacto: Where to look com arquivo e intervalo, sem Code excerpts nem File outlines', async t => {
  const { root } = await project(t, { hot: [3] });
  const r = await contextPack(root, query, compactOpts({ request: fake() }));
  assert.equal(r.status, 'ok');
  assert.match(r.text, /## Where to look\n- src\/billing\.py L124-164: /);
  assert.ok(!r.text.includes('## Code excerpts')); assert.ok(!r.text.includes('## File outlines'));
});
test('compacto: Best match, verbatim só com confiança alta e trecho curto, com linhas corretas', async t => {
  const { root, code } = await project(t, { hot: [3], blockLen: 10 });
  const r = await contextPack(root, query, compactOpts({ request: fake() }));
  assert.equal(r.confidence, 'high');
  assert.ok(r.text.includes('## Best match, verbatim'));
  const real = code.split('\n');
  const at = r.text.indexOf('## Best match, verbatim');
  const nums = [];
  for (const l of r.text.slice(at).split('\n').slice(1)) { const m = l.match(/^\s*(\d+)\| (.*)$/); if (m) nums.push([Number(m[1]), m[2]]); }
  assert.ok(nums.length > 0);
  for (const [n, l] of nums) assert.equal(l, real[n - 1]);
  const long = await project(t, { hot: [3] });
  const l = await contextPack(long.root, query, compactOpts({ request: fake() }));
  assert.equal(l.confidence, 'high'); assert.ok(l.text.includes('## Where to look'));
  assert.ok(!l.text.includes('## Best match, verbatim'));
  const med = await project(t);
  const m = await contextPack(med.root, query, compactOpts({ request: scoredBy({ 'src/billing.py': { 83: 0.45 } }) }));
  assert.equal(m.confidence, 'medium');
  assert.ok(!m.text.includes('## Best match, verbatim'));
});
test('compacto: partes da mesma nota viram uma linha em Related notes com os dois títulos', async t => {
  const long = Array.from({ length: 5 }, (_, i) => '# Seção ' + i + '\nHOTSPOT ' + String.fromCharCode(97 + i).repeat(1600)).join('\n');
  const { root } = await project(t, { memory: long });
  const r = await contextPack(root, query, compactOpts({ request: fake() }));
  assert.ok(r.text.includes('## Related notes'));
  const lines = r.text.split('\n').filter(l => l.includes('policy.md)'));
  assert.equal(lines.length, 1, r.text);
  assert.match(lines[0], /Seção \d.*, Seção \d/);
});
test('compacto: confiança baixa não tem Where to look e mantém Other likely files', async t => {
  const { root } = await project(t, { hot: [] });
  const request = async (_, options) => {
    const body = JSON.parse(options.body), answers = {};
    for (const [k, q] of Object.entries(body.questions)) answers[k] = { type: 'noul', noul: q.instructions.startsWith('Does this excerpt') ? 0.05 : 0.9 };
    return reply(answers);
  };
  const r = await contextPack(root, query, compactOpts({ request }));
  assert.equal(r.confidence, 'low');
  assert.ok(!r.text.includes('## Where to look'));
  assert.ok(r.text.includes('## Other likely files') && r.text.includes('billing.py'), r.text);
});
test('compacto: texto muito menor que o completo para a mesma entrada', async t => {
  const { root } = await project(t, { hot: [3, 7], memory: '# Regra\nA regra HOTSPOT usa ROUND_HALF_UP para arredondar.' });
  const c = await contextPack(root, query, compactOpts({ request: fake() }));
  const f = await contextPack(root, query, compactOpts({ request: fake(), contextMode: 'full' }));
  assert.ok(c.text.length * 2 < f.text.length, c.text.length + ' vs ' + f.text.length);
});
test('optionsFromEnv: JEV_GRAPHIFY_CONTEXT full/compact, ausente e inválido', () => {
  const abs = process.cwd();
  assert.equal(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs, JEV_GRAPHIFY_CONTEXT: 'full' }).options.contextMode, 'full');
  assert.equal(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs, JEV_GRAPHIFY_CONTEXT: 'compact' }).options.contextMode, 'compact');
  assert.ok(!('contextMode' in optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs }).options));
  assert.equal(optionsFromEnv({ JEV_GRAPHIFY_PROJECT: abs, JEV_GRAPHIFY_CONTEXT: 'x' }).error, 'JEV_GRAPHIFY_CONTEXT must be compact or full.');
});
