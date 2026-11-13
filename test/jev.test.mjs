import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, ask, scrub } from '../src/jev.mjs';
import { mockJev } from './helpers.mjs';
const input = { task: 'Corrigir faturas', candidates: [{ id: 'policy', title: 'Faturas', description: 'Arredondamento' }], key: 'fictional-test-credential' };
test('contrato Jev envia chave só no cabeçalho e aceita escolha válida', async () => {
  const result = await choose({ ...input, request: async (url, options) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, 'Bearer fictional-test-credential');
    assert.ok(!options.body.includes(input.key));
    const body = JSON.parse(options.body); assert.ok(body.questions.selection.criteria.none); assert.equal(body.model, 'jev-latest');
    return mockJev()();
  } });
  assert.equal(result.status, 'selected'); assert.deepEqual(result.ids, ['policy']); assert.equal(result.usage.input_tokens, 10);
});
for (const [choice, confidence, status] of [['none', 0.9, 'none'], ['c0', 0.49, 'uncertain'], ['invalid', 0.9, 'invalid'], ['c0', 2, 'invalid'], ['c0', null, 'invalid']]) test(`Jev ${choice}/${confidence}: ${status}`, async () => {
  const result = await choose({ ...input, request: mockJev(choice, confidence) }); assert.equal(result.status, status); assert.deepEqual(result.ids, []);
});
test('sem chave ou habilitação, nenhuma chamada ocorre', async () => {
  for (const [overrides, reason] of [[{ jev: false }, 'turned_off'], [{ key: '' }, 'no_key'], [{ key: undefined }, 'no_key']]) {
    let called = false; const result = await choose({ ...input, ...overrides, request: async () => { called = true; } });
    assert.equal(result.status, 'disabled'); assert.equal(result.reason, reason); assert.equal(called, false);
  }
});
test('falha HTTP, JSON inválido e resposta grande não vazam mensagem', async () => {
  for (const response of [new Response('private service text', { status: 401 }), new Response('{bad'), new Response('x'.repeat(65537))]) {
    const result = await choose({ ...input, request: async () => response });
    assert.ok(['unavailable', 'invalid'].includes(result.status)); assert.deepEqual(result.ids, []); assert.ok(!JSON.stringify(result).includes('private'));
  }
});
test('timeout e cancelamento', async () => {
  const request = async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.equal((await choose({ ...input, timeoutMs: 10, request })).status, 'unavailable');
    const ac = new AbortController(); setTimeout(() => ac.abort(), 10);
    await assert.rejects(choose({ ...input, request, signal: ac.signal }));
  } finally { clearInterval(keepAlive); }
});
test('scrub apaga segredos, mantém chaves e conta', () => {
  const { value, redactions } = scrub({ a: ['token=abcd1234efgh5678 e sk-' + 'a'.repeat(24), 'AKIA' + 'A'.repeat(16)], password: 'senha: hunter2hunter2', n: 5, ok: 'texto normal' });
  assert.equal(redactions, 4); assert.equal(value.n, 5); assert.equal(value.ok, 'texto normal');
  assert.equal(value.a[0], 'token=[REDACTED] e [REDACTED]'); assert.equal(value.password, 'senha: [REDACTED]');
  assert.equal(scrub('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----').value, '[REDACTED]');
});
test('ask sem chave não chama; onSend recebe só metadados', async () => {
  let calls = 0; assert.deepEqual(await ask({ state: 'x', questions: {}, request: async () => { calls++; } }), { status: 'disabled', reason: 'no_key' }); assert.equal(calls, 0);
  const sent = []; const r = await ask({ state: 'token=abcd1234efgh5678', questions: { q: { type: 'noul', instructions: 'i' } }, key: 'fictional-test-credential', onSend: m => { sent.push(m); throw Error('ignorado'); }, request: async (_, o) => { assert.ok(!o.body.includes('abcd1234')); return new Response(JSON.stringify({ answers: { q: { type: 'noul', noul: 0.5 } }, usage: { input_tokens: 7 } })); } });
  assert.equal(r.status, 'ok'); assert.equal(sent.length, 1); assert.deepEqual({ ...sent[0], bytes: 0 }, { questions: 1, bytes: 0, redactions: 1, attempts: 1, status: 'ok', input_tokens: 7 });
});
test('ask repete em 429 e desiste com http', async () => {
  let n = 0; const key = 'fictional-test-credential';
  assert.equal((await ask({ state: 'x', questions: {}, key, request: async () => new Response(++n < 2 ? '' : '{"answers":{}}', { status: n < 2 ? 429 : 200 }) })).status, 'ok'); assert.equal(n, 2);
  n = 0; const r = await ask({ state: 'x', questions: {}, key, retries: 1, request: async () => { n++; return new Response('', { status: 529 }); } });
  assert.deepEqual(r, { status: 'unavailable', http: 529 }); assert.equal(n, 2);
});
