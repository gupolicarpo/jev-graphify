import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixture, recoveryInput } from './helpers.mjs';
import { hash, atomicJson, usedToday, jevGate, appendSendLog } from '../src/files.mjs';
import { recall } from '../src/memory.mjs';
import { findSkill } from '../src/skills.mjs';
import { findInProject, walkCode, fingerprint } from '../src/project.mjs';
import * as core from '../src/core.mjs';
const key = 'fictional-test-credential';
const today = new Date().toISOString().slice(0, 10), old = '2020-01-01T00:00:00.000Z';
const logFile = root => resolve(root, '.jev-graphify/sent.jsonl');
async function prefill(root, lines) { await mkdir(resolve(root, '.jev-graphify'), { recursive: true }); await writeFile(logFile(root), lines.map(l => typeof l === 'string' ? l : JSON.stringify(l)).join('\n') + '\n'); }
const counting = () => { const state = { calls: 0 }; state.request = async () => { state.calls++; throw Error('sem rede'); }; return state; };
test('usedToday soma só as linhas de hoje e ignora linhas malformadas', async t => {
  const { root } = await fixture(t);
  assert.equal(await usedToday(root), 0);
  await prefill(root, [{ at: today + 'T01:00:00.000Z', purpose: 'recall', input_tokens: 100 }, { at: old, purpose: 'recall', input_tokens: 999 }, 'não é json', '{"at":', { at: today + 'T02:00:00.000Z', purpose: 'x' }, { at: today + 'T03:00:00.000Z', input_tokens: 'a' }, { at: today + 'T04:00:00.000Z', input_tokens: 50 }]);
  assert.equal(await usedToday(root), 150);
});
test('rotação do registro escreve linha carry e preserva o total do dia', async t => {
  const { root } = await fixture(t);
  const filler = JSON.stringify({ at: old, purpose: 'recall', input_tokens: 1, pad: 'x'.repeat(900) });
  await prefill(root, [{ at: today + 'T00:00:00.000Z', purpose: 'recall', input_tokens: 300 }, ...Array(1200).fill(filler)]);
  assert.equal(await usedToday(root), 300);
  await appendSendLog(root, { purpose: 'recall', input_tokens: 40 });
  const lines = (await readFile(logFile(root), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 2); assert.equal(lines[0].purpose, 'carry'); assert.equal(lines[0].input_tokens, 300); assert.equal(lines[1].input_tokens, 40);
  assert.equal(await usedToday(root), 340);
});
test('jevGate: turned_off, no_key, daily_limit, limite 0 e teto inválido', async t => {
  const { root } = await fixture(t);
  assert.deepEqual(await jevGate(root, { jev: false, key }), { jev: false, reason: 'turned_off' });
  assert.deepEqual(await jevGate(root, {}), { jev: false, reason: 'no_key' });
  assert.deepEqual(await jevGate(root, { key }), { jev: true });
  await prefill(root, [{ at: today + 'T01:00:00.000Z', input_tokens: 100 }]);
  assert.deepEqual(await jevGate(root, { key, dailyTokens: 100 }), { jev: false, reason: 'daily_limit', daily: { used: 100, limit: 100 } });
  assert.deepEqual(await jevGate(root, { key, dailyTokens: 101 }), { jev: true });
  assert.deepEqual(await jevGate(root, { key, dailyTokens: 0 }), { jev: true });
  for (const bad of [-1, 1.5, '10', NaN]) await assert.rejects(jevGate(root, { key, dailyTokens: bad }), /Teto diário inválido: use um inteiro maior ou igual a zero\./);
});
test('acima do teto diário recall e findSkill não fazem requisições e voltam ao modo local', async t => {
  const { root } = await fixture(t), net = counting();
  await prefill(root, [{ at: today + 'T01:00:00.000Z', input_tokens: 500 }]);
  const r = await recall(root, 'Aurora', { autoMemory: false, key, request: net.request, dailyTokens: 500 });
  assert.equal(r.status, 'local'); assert.equal(r.reason, 'daily_limit'); assert.deepEqual(r.daily, { used: 500, limit: 500 }); assert.ok(r.items.length > 0);
  const s = await findSkill(root, 'Corrigir faturas', { key, request: net.request, dailyTokens: 500 });
  assert.equal(s.status, 'disabled'); assert.equal(s.reason, 'daily_limit'); assert.deepEqual(s.daily, { used: 500, limit: 500 });
  assert.equal(net.calls, 0);
  await assert.rejects(recall(root, 'Aurora', { autoMemory: false, key, request: net.request, dailyTokens: -1 }), /Teto diário inválido/);
});
test('abaixo do teto diário recall e findSkill chamam o Jev como antes', async t => {
  const { root } = await fixture(t), net = counting();
  await prefill(root, [{ at: today + 'T01:00:00.000Z', input_tokens: 499 }]);
  const r = await recall(root, 'Aurora', { autoMemory: false, key, request: net.request, dailyTokens: 500 });
  assert.notEqual(r.reason, 'daily_limit'); assert.ok(net.calls > 0);
  const before = net.calls;
  await findSkill(root, 'Corrigir faturas', { key, request: net.request, dailyTokens: 500 });
  assert.ok(net.calls > before);
});
test('route e recover tratam o teto diário como Jev desligado, com reason e daily', async t => {
  const { root } = await fixture(t), net = counting();
  await prefill(root, [{ at: today + 'T01:00:00.000Z', input_tokens: 10 }]);
  const route = await core.route(root, 'Corrigir faturas', { key, request: net.request, dailyTokens: 10 });
  assert.equal(route.skill.status, 'disabled'); assert.equal(route.skill.reason, 'daily_limit'); assert.deepEqual(route.skill.daily, { used: 10, limit: 10 });
  const rec = await core.recover(root, recoveryInput, { key, request: net.request, dailyTokens: 10 });
  assert.equal(rec.status, 'memory_pending'); assert.equal(rec.selection.reason, 'daily_limit'); assert.deepEqual(rec.selection.daily, { used: 10, limit: 10 });
  assert.equal(net.calls, 0);
});
test('findInProject acima do teto diário não faz requisições e devolve ranking local', async t => {
  const { root } = await fixture(t), net = counting(), code = { roots: ['src'] };
  await mkdir(resolve(root, 'src'), { recursive: true }); await writeFile(resolve(root, 'src/billing.py'), 'def f():\n    return 1\n');
  const cfg = JSON.parse(await readFile(resolve(root, '.jev-graphify.json'), 'utf8'));
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...cfg, code }));
  const { files } = await walkCode(root, code);
  await atomicJson(root, '.jev-graphify/project.json', { schema: 1, project: hash(await realpath(root)), generatedAt: '2026-01-01T00:00:00Z', fingerprint: fingerprint(files), graphify: { version: '0.9.107', nodes: 1, edges: 0, communities: 1 }, files: [{ file: 'src/billing.py', nucleo: 0, simbolos: ['billing_service'] }], nucleos: [{ id: 0, rotulos: ['x'], pastas: ['src'], arquivos: ['src/billing.py'] }] });
  await prefill(root, [{ at: today + 'T01:00:00.000Z', input_tokens: 70 }]);
  const r = await findInProject(root, 'billing', { key, request: net.request, dailyTokens: 70 });
  assert.equal(r.status, 'local'); assert.equal(r.reason, 'daily_limit'); assert.deepEqual(r.daily, { used: 70, limit: 70 }); assert.equal(r.items[0].file, 'src/billing.py');
  assert.equal(net.calls, 0);
  const under = await findInProject(root, 'billing', { key, request: net.request, dailyTokens: 71 });
  assert.notEqual(under.reason, 'daily_limit'); assert.ok(net.calls > 0);
});
