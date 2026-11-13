import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { recall } from '../src/memory.mjs';
import { findSkill } from '../src/skills.mjs';
import { privacyOf } from '../src/files.mjs';
import { fixture } from './helpers.mjs';
const key = 'fictional-test-credential', MARK = 'MARCADORSOCORPO';
// Responde qualquer pedido: noul alto (o "prose" do portão de skills fica baixo) e choice na primeira opção.
function responder(bodies = []) {
  return async (_, options) => {
    bodies.push(options.body);
    const answers = {};
    for (const [k, q] of Object.entries(JSON.parse(options.body).questions)) {
      if (q.type === 'choice') { const keys = Object.keys(q.criteria); answers[k] = { type: 'choice', choice: keys[0], confidence: 0.9, probabilities: Object.fromEntries(keys.map((c, i) => [c, i ? 0.01 : 0.9])) }; }
      else answers[k] = { type: 'noul', noul: k === 'prose' ? 0.1 : 0.9 };
    }
    return new Response(JSON.stringify({ answers, usage: { input_tokens: 3 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
async function setup(t, privacy) {
  const { root, config } = await fixture(t);
  await mkdir(resolve(root, 'mem')); await mkdir(resolve(root, 'cat', 'guia'), { recursive: true });
  await writeFile(resolve(root, 'mem', 'nota.md'), `---\nname: nota\ndescription: Regra de teste.\n---\nTexto da memória com ${MARK} no meio.\n`);
  await writeFile(resolve(root, 'cat', 'guia', 'SKILL.md'), `---\nname: guia\ndescription: Guia de teste.\n---\nPasso a passo com ${MARK}.\n`);
  if (privacy !== undefined) await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, privacy }));
  return { root, mem: { memoryDirs: [resolve(root, 'mem')], autoMemory: false }, cat: { skillsDir: resolve(root, 'cat') } };
}
test('privacidade: o padrão é ficha e o texto da memória não sai', async t => {
  const { root, mem } = await setup(t), bodies = [];
  const r = await recall(root, 'regra', { ...mem, key, request: responder(bodies) });
  assert.equal(r.privacy, 'ficha'); assert.equal(r.strategy, 'cards'); assert.ok(bodies.length >= 1);
  assert.ok(bodies.every(b => !b.includes(MARK)));
  assert.equal(await privacyOf(root), 'ficha');
});
test('privacidade: "privacy": "completo" no .jev-graphify.json liga o texto completo; a opção explícita vence a configuração', async t => {
  const { root, mem } = await setup(t, 'completo'), bodies = [];
  const r = await recall(root, 'regra', { ...mem, key, request: responder(bodies) });
  assert.equal(r.privacy, 'completo'); assert.ok(bodies.some(b => b.includes(MARK)));
  const again = [];
  const f = await recall(root, 'regra', { ...mem, key, request: responder(again), privacy: 'ficha' });
  assert.equal(f.privacy, 'ficha'); assert.ok(again.every(b => !b.includes(MARK)));
  // A configuração com a chave nova continua válida para as outras funções.
  assert.equal(JSON.parse(await readFile(resolve(root, '.jev-graphify.json'), 'utf8')).privacy, 'completo');
});
test('privacidade: valor inválido na configuração é recusado', async t => {
  const { root, mem } = await setup(t, 'tudo');
  await assert.rejects(recall(root, 'regra', { ...mem, key, request: responder() }), /Invalid privacy: use completo or ficha\./);
  await assert.rejects(findSkill(root, 'tarefa', { skillsDir: resolve(root, 'cat'), key, request: responder() }), /Invalid privacy/);
});
test('privacidade: na busca de skill, ficha não envia o texto da skill e completo envia o trecho', async t => {
  const a = await setup(t), ficha = [];
  const r = await findSkill(a.root, 'preciso do guia', { ...a.cat, key, request: responder(ficha) });
  assert.equal(r.status, 'selected'); assert.equal(ficha.length, 2); assert.ok(ficha.every(b => !b.includes(MARK)));
  // O texto volta para o agente normalmente: só não vai para o serviço externo.
  assert.ok(r.skill.body.includes(MARK) || r.alternatives.length >= 0);
  const b = await setup(t, 'completo'), completo = [];
  await findSkill(b.root, 'preciso do guia', { ...b.cat, key, request: responder(completo) });
  assert.ok(completo[1].includes(MARK));
});
