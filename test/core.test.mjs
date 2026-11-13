import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, symlink, cp, utimes, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as core from '../src/core.mjs';
import { fixture, simulated, recoveryInput, mockJev } from './helpers.mjs';
test('busca no corpo, origem, hash e marca de confiança', async t => {
  const { root } = await fixture(t);
  const result = await core.search(root, 'Aurora');
  assert.equal(result.candidates[0].source, 'policy.md');
  assert.match(result.candidates[0].version, /^[a-f0-9]{64}$/);
  const memory = await core.read(root, result.candidates[0].id);
  assert.match(memory.body, /1.005/); assert.equal(memory.trust, 'untrusted_project_data');
});
test('percurso de grafo encontra documento sem termo lexical', async t => {
  const { root } = await fixture(t);
  assert.deepEqual((await core.search(root, 'checkout')).candidates.map(r => r.source).sort(), ['code.py', 'policy.md']);
});
test('consulta desatualizada é bloqueada', async t => {
  const { root } = await fixture(t);
  await writeFile(resolve(root, 'policy.md'), '# Nova regra');
  assert.equal((await core.status(root)).status, 'stale');
  await assert.rejects(core.search(root, 'regra'), /desatualizada/);
});
test('índice copiado de outro projeto e IDs estranhos são recusados', async t => {
  const a = await fixture(t), b = await fixture(t);
  await assert.rejects(core.read(a.root, 'unknown'), /não pertence/);
  await cp(resolve(a.root, '.jev-graphify/index.json'), resolve(b.root, '.jev-graphify/index.json'));
  await assert.rejects(core.search(b.root, 'faturas'), /outro projeto/);
});
test('fontes fora do escopo, privadas e grandes são recusadas', async t => {
  const { root, config } = await fixture(t);
  for (const source of ['../private.md', '/outside.md', '.env', 'secrets.md', 'config/key.md', 'C:/outside.md']) {
    await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, sources: [source] }));
    await assert.rejects(core.status(root));
  }
  await writeFile(resolve(root, 'large.md'), 'x'.repeat(131073));
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, sources: ['large.md'] }));
  await assert.rejects(core.status(root), /grande demais/);
});
test('diretórios com junction não escapam do projeto', async t => {
  const a = await fixture(t), b = await fixture(t);
  await symlink(b.root, resolve(a.root, 'linked'), 'junction');
  await writeFile(resolve(a.root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: ['linked/policy.md'], skills: [] }));
  await assert.rejects(core.status(a.root), /simbólicos/);
});
test('route usa Jev simulado e inclui contexto com versão', async t => {
  const { root } = await fixture(t), result = await core.route(root, 'Corrigir faturas', simulated);
  assert.equal(result.skill.status, 'selected'); assert.equal(result.reference.status, 'selected');
  assert.equal(result.reference.context[0].source, 'policy.md');
});
test('route sem chave ou com Jev desligado não acessa rede', async t => {
  const { root } = await fixture(t); let calls = 0; const request = () => { calls++; throw Error('Network forbidden'); };
  for (const [options, reason] of [[{ key: 'fictional', jev: false, request }, 'turned_off'], [{ request }, 'no_key']]) {
    const result = await core.route(root, 'Corrigir faturas', options);
    assert.equal(result.skill.status, 'disabled'); assert.equal(result.reference.status, 'disabled'); assert.equal(result.skill.reason, reason);
  }
  assert.equal(calls, 0);
});
test('route com Jev registra o envio sem conteúdo', async t => {
  const { root } = await fixture(t); await core.route(root, 'Corrigir faturas', simulated);
  const log = await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8');
  assert.deepEqual(log.trim().split('\n').map(l => JSON.parse(l).purpose), ['route', 'route']);
  assert.ok(!log.includes('faturas') && !log.includes(simulated.key));
});
test('recuperação entrega contexto ao executor, sem fingir correção', async t => {
  const { root } = await fixture(t), result = await core.recover(root, recoveryInput, simulated);
  assert.equal(result.status, 'ready_for_executor'); assert.equal(result.memories[0].source, 'policy.md'); assert.equal(result.maxRounds, 2);
});
test('recuperação não aprova evidência inventada ou terceira rodada', async t => {
  const { root } = await fixture(t);
  await assert.rejects(core.recover(root, { ...recoveryInput, diagnosis: { ...recoveryInput.diagnosis, evidence: 'Texto que não aparece na falha' } }));
  await assert.rejects(core.recover(root, { ...recoveryInput, round: 3 }));
  await assert.rejects(core.recover(root, { ...recoveryInput, loadedIds: ['outside'] }));
});
test('code_issue não consulta Jev; inconclusivo e memória ausente ficam pendentes', async t => {
  const { root } = await fixture(t);
  const failRequest = () => { throw Error('Jev should not run'); };
  assert.equal((await core.recover(root, { ...recoveryInput, diagnosis: { ...recoveryInput.diagnosis, kind: 'code_issue', queries: [] } }, { ...simulated, request: failRequest })).status, 'ready_for_executor');
  assert.equal((await core.recover(root, { ...recoveryInput, diagnosis: { ...recoveryInput.diagnosis, kind: 'inconclusive', queries: [] } })).status, 'review_pending');
  assert.equal((await core.recover(root, recoveryInput)).status, 'memory_pending');
  assert.equal((await core.recover(root, recoveryInput, { ...simulated, request: mockJev('none') })).status, 'memory_pending');
});
test('init não sobrescreve configuração existente', async t => {
  const { root } = await fixture(t);
  const before = await readFile(resolve(root, '.jev-graphify.json'), 'utf8');
  await assert.rejects(core.init(root), { code: 'EEXIST' });
  assert.equal(await readFile(resolve(root, '.jev-graphify.json'), 'utf8'), before);
});

test('snapshot adulterado não pode alegar o hash de uma fonte íntegra', async t => {
  const { root, index } = await fixture(t);
  index.records[0].body = 'Regra adulterada';
  await writeFile(resolve(root, '.jev-graphify/index.json'), JSON.stringify(index));
  assert.equal((await core.status(root)).status, 'invalid');
  await assert.rejects(core.search(root, 'faturas'), /Snapshots/);
});
test('busca aceita variações da palavra sem casar termos curtos diferentes', async t => {
  const { root } = await fixture(t);
  for (const q of ['arredondamento', 'arredondar', 'fatura']) assert.equal((await core.search(root, q)).candidates[0]?.source, 'policy.md', q);
  assert.deepEqual((await core.search(root, 'arrecadação')).candidates, []);
});
test('bônus de grafo conta uma vez por arquivo, não por símbolo', async t => {
  const { root, index } = await fixture(t);
  for (const id of ['c', 'd', 'e']) { index.graph.nodes.push({ id, title: 'helper_' + id, source: 'code.py' }); index.graph.edges.push({ source: 'a', target: id }); }
  await writeFile(resolve(root, '.jev-graphify/index.json'), JSON.stringify(index));
  const scores = Object.fromEntries((await core.search(root, 'checkout')).candidates.map(r => [r.source, r.score]));
  assert.deepEqual(scores, { 'code.py': 7, 'policy.md': 2 });
});
test('recuperação com várias consultas ordena pelo melhor score de cada referência', async t => {
  const { root } = await fixture(t);
  const result = await core.recover(root, { ...recoveryInput, diagnosis: { ...recoveryInput.diagnosis, queries: ['Aurora', 'checkout'] } });
  assert.deepEqual(result.candidates.map(r => [r.source, r.score]), [['code.py', 7], ['policy.md', 5]]);
});
test('trava de atualização: a ativa bloqueia, a residual é assumida', async t => {
  const { root } = await fixture(t), lock = resolve(root, '.jev-graphify/update.lock');
  await writeFile(lock, JSON.stringify({ pid: process.pid }));
  await assert.rejects(core.update(root), /em andamento/);
  // Dono já terminou: assume na hora.
  await writeFile(lock, JSON.stringify({ pid: spawnSync(process.execPath, ['-e', '']).pid }));
  assert.equal((await core.update(root)).status, 'unchanged');
  // Trava sem PID (formato da 0.1.1): só expira pela idade.
  await writeFile(lock, '');
  await assert.rejects(core.update(root), /em andamento/);
  const old = new Date(Date.now() - core.lockMaxAge - 1000); await utimes(lock, old, old);
  assert.equal((await core.update(root)).status, 'unchanged');
  await assert.rejects(access(lock), { code: 'ENOENT' });
});
test('erros de fonte dizem qual arquivo falhou', async t => {
  const { root, config } = await fixture(t);
  const failing = async source => { await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ ...config, sources: [source] })); return core.status(root); };
  await writeFile(resolve(root, 'utf16.md'), Buffer.from('﻿Regra', 'utf16le'));
  await assert.rejects(failing('utf16.md'), /UTF-8.*utf16\.md/);
  await assert.rejects(failing('dados.csv'), /não suportado: dados\.csv/);
  await assert.rejects(failing('src/config/loader.py'), /privado.*src\/config\/loader\.py/);
});
test('Python: variável explícita, depois o ambiente ao lado do plugin, depois o do sistema', async () => {
  const { defaultPython } = await import('../src/graphify.mjs');
  assert.equal(defaultPython({ JEV_GRAPHIFY_PYTHON: 'meu-python' }, () => true), 'meu-python');
  assert.match(defaultPython({}, () => true), /\.venv-graphify[\\/](?:Scripts[\\/]python\.exe|bin[\\/]python)$/);
  assert.match(defaultPython({}, () => false), /^python3?$/);
});
test('falha do Graphify mostra o motivo real', async t => {
  const { root, records } = await fixture(t);
  const { generateGraph } = await import('../src/graphify.mjs');
  await assert.rejects(generateGraph(root, records, { python: 'python-inexistente-jev' }), /Python não encontrado: python-inexistente-jev/);
});
