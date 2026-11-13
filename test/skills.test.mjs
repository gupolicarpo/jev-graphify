import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frontmatter, loadCatalog, findSkill, GATE_ACTION, GATE_NAMED, FIT_MIN } from '../src/skills.mjs';
import { fixture } from './helpers.mjs';
const key = 'fictional-test-credential';
const md = (name, description, body = 'Passo 1. Faça o procedimento.') => `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n`;
async function external(root, entries) {
  const dir = resolve(root, 'catalogo'); await mkdir(dir, { recursive: true });
  for (const [name, text] of Object.entries(entries)) { await mkdir(resolve(dir, name)); await writeFile(resolve(dir, name, 'SKILL.md'), text); }
  return dir;
}
const bare = root => writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [] }));
const reply = (answers, status = 200) => new Response(JSON.stringify({ answers, usage: { input_tokens: 5 } }), { status, headers: { 'content-type': 'application/json' } });
// Responde etapa 1 e etapa 2 olhando o corpo recebido.
function scripted({ probs = {}, nouls = { acts: 0.9, procedure: 0.9, prose: 0.1, named: 0.2 }, fits = {}, winner, calls = [] } = {}) {
  const request = async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const q = body.questions, keys = Object.keys(q.which.criteria);
    if (!Object.keys(q).some(k => k.startsWith('fits::'))) {
      const answers = { which: { type: 'choice', choice: keys[0], confidence: 0.5, probabilities: Object.fromEntries(keys.map(k => [k, probs[k] ?? 0.01])) } };
      if (q.acts) for (const k of Object.keys(nouls)) answers[k] = { type: 'noul', noul: nouls[k] };
      return reply(answers);
    }
    const answers = { which: { type: 'choice', choice: winner ?? keys[0], confidence: 0.8, probabilities: Object.fromEntries(keys.map((k, i) => [k, 0.7 - i * 0.2])) } };
    for (const k of keys) answers['fits::' + k] = { type: 'noul', noul: fits[k] ?? 0.9 };
    return reply(answers);
  };
  return { request, calls };
}
const six = { 'pdf-fill': md('pdf-fill', 'Preencher formulários PDF com dados.'), 'pdf-merge': md('pdf-merge', 'Juntar vários PDF em um.'), xlsx: md('xlsx', 'Planilhas e fórmulas.'), docx: md('docx', 'Documentos Word.'), slides: md('slides', 'Apresentações.'), audio: md('audio', 'Transcrever áudio.') };
test('frontmatter: simples, aspas, blocos > e | e sem frontmatter', () => {
  assert.deepEqual(frontmatter('---\nname: a\ndescription: "Faz x"\n---\ncorpo'), { name: 'a', description: 'Faz x', body: 'corpo' });
  assert.equal(frontmatter("---\nname: 'b c'\n---\n").name, 'b c');
  assert.equal(frontmatter('---\nname: n\ndescription: >\n  linha um\n  linha dois\nother: 1\n---\nx').description, 'linha um linha dois');
  assert.equal(frontmatter('---\ndescription: |-\n  a\n  b\n---\nx').description, 'a b');
  assert.equal(frontmatter('---\r\nname: crlf\r\n---\r\ncorpo').name, 'crlf');
  assert.deepEqual(frontmatter('só texto'), { name: undefined, description: undefined, body: 'só texto' });
});
test('catálogo externo: ignora não-pastas e pastas sem SKILL.md, chaves únicas, ordenado', async t => {
  const { root } = await fixture(t); await bare(root);
  const dir = await external(root, { 'Beta Skill': md('Beta Skill', 'b'), alfa: md('dup', 'a'), gama: md('dup', 'g') });
  await writeFile(resolve(dir, 'solto.md'), 'x'); await mkdir(resolve(dir, 'vazia'));
  const { skills, skipped } = await loadCatalog(root, { skillsDir: dir });
  assert.deepEqual(skills.map(s => s.key), ['beta-skill', 'dup', 'dup-2']);
  assert.deepEqual(skills.map(s => s.source), ['Beta Skill/SKILL.md', 'alfa/SKILL.md', 'gama/SKILL.md']);
  assert.deepEqual(skipped, []); assert.match(skills[0].path, /SKILL\.md$/);
});
test('catálogo externo: skillsDir inválido é recusado', async t => {
  const { root } = await fixture(t);
  for (const bad of ['relativo/pasta', resolve(root, 'nao-existe'), resolve(root, 'policy.md')]) await assert.rejects(loadCatalog(root, { skillsDir: bad }), /Invalid skills folder/);
});
test('catálogo externo: SKILL.md grande ou não UTF-8 é registrado como ignorado', async t => {
  const { root } = await fixture(t); await bare(root);
  const dir = await external(root, { grande: 'x'.repeat(131073), latin: 'x', ok: md('ok', 'tudo certo') });
  await writeFile(resolve(dir, 'latin', 'SKILL.md'), Buffer.from([0xff, 0xfe, 0x41, 0xe9]));
  const { skills, skipped } = await loadCatalog(root, { skillsDir: dir });
  assert.deepEqual(skills.map(s => s.name), ['ok']); assert.deepEqual(skipped.map(s => s.source).sort(), ['grande/SKILL.md', 'latin/SKILL.md']);
  // A busca avisa quais skills ficaram de fora.
  assert.deepEqual((await findSkill(root, 'tudo certo', { skillsDir: dir })).skipped.map(s => s.source).sort(), ['grande/SKILL.md', 'latin/SKILL.md']);
});
test('catálogo externo: pasta com link/junction é ignorada', async t => {
  const { root } = await fixture(t); await bare(root);
  const dir = await external(root, { real: md('real', 'r') });
  await symlink(resolve(dir, 'real'), resolve(dir, 'ligada'), 'junction');
  assert.deepEqual((await loadCatalog(root, { skillsDir: dir })).skills.map(s => s.name), ['real']);
});
test('skills do projeto e externas são combinadas; nome e descrição de reserva', async t => {
  const { root } = await fixture(t);
  const dir = await external(root, { ext: 'Sem frontmatter, texto   com\nquebras.' });
  const { skills } = await loadCatalog(root, { skillsDir: dir });
  assert.deepEqual(skills.map(s => [s.name, s.source]), [['rounding', 'skill.md'], ['ext', 'ext/SKILL.md']]);
  assert.equal(skills[0].description, 'Corrigir arredondamento de faturas.'); assert.equal(skills[1].description, 'Sem frontmatter, texto com quebras.');
  assert.equal(skills[0].path, resolve(root, 'skill.md').replace(/^./, c => skills[0].path[0]));
});
test('limite de 1020 skills', async t => {
  const { root } = await fixture(t), many = {};
  for (let i = 0; i < 1021; i++) many['s' + i] = 'x';
  await assert.rejects(loadCatalog(root, { skillsDir: await external(root, many) }), /over the limit of 1020/);
});
test('catálogo vazio e consulta inválida', async t => {
  const { root } = await fixture(t);
  await writeFile(resolve(root, '.jev-graphify.json'), JSON.stringify({ version: 1, sources: [], skills: [] }));
  assert.equal((await findSkill(root, 'algo', { key })).status, 'empty_catalog');
  for (const bad of ['', '   ', 'x'.repeat(4001), 5]) await assert.rejects(findSkill(root, bad), /Invalid query/);
});
test('sem chave ou com Jev desligado: candidatas locais e nenhuma requisição', async t => {
  const { root } = await fixture(t), dir = await external(root, six); let calls = 0; const request = async () => { calls++; };
  const off = await findSkill(root, 'preencher formulários PDF', { skillsDir: dir, request });
  assert.equal(off.status, 'disabled'); assert.equal(off.reason, 'no_key'); assert.equal(off.catalog, 7); assert.equal(off.candidates[0].name, 'pdf-fill'); assert.equal(off.trust, 'user_skill_catalog');
  const no = await findSkill(root, 'preencher formulários PDF', { skillsDir: dir, key, jev: false, request });
  assert.equal(no.reason, 'turned_off'); assert.ok(no.candidates.length <= 5); assert.equal(calls, 0);
});
test('fluxo selecionado em duas etapas', async t => {
  const { root } = await fixture(t), dir = await external(root, six);
  const calls = [], { request } = scripted({ calls, probs: { 'pdf-fill': 0.6, 'pdf-merge': 0.3, xlsx: 0.2, docx: 0.1 }, winner: 'pdf-fill', fits: { 'pdf-fill': 0.95 } });
  const r = await findSkill(root, 'Preencher este formulário PDF', { skillsDir: dir, key, request });
  assert.equal(calls.length, 2); assert.equal(r.requests, 2); assert.equal(r.status, 'selected');
  assert.deepEqual(Object.keys(calls[0].questions).sort(), ['acts', 'named', 'procedure', 'prose', 'which']);
  assert.equal(calls[0].model, 'jev-latest'); assert.deepEqual(calls[0].state, { request: 'Preencher este formulário PDF' });
  assert.equal(Object.keys(calls[0].questions.which.criteria).length, 7);
  assert.deepEqual(Object.keys(calls[1].questions.which.criteria), ['pdf-fill', 'pdf-merge', 'xlsx']);
  assert.deepEqual(Object.keys(calls[1].questions).filter(k => k.startsWith('fits::')), ['fits::pdf-fill', 'fits::pdf-merge', 'fits::xlsx']);
  assert.equal(r.skill.name, 'pdf-fill'); assert.equal(r.skill.body, six['pdf-fill']); assert.equal(r.skill.truncated, false); assert.match(r.skill.path, /pdf-fill[\\/]SKILL\.md$/);
  assert.equal(r.confidence, 0.7); assert.equal(r.fit, 0.95); assert.equal(r.alternatives.length, 2); assert.equal(r.alternatives[0].name, 'pdf-merge');
  assert.equal(r.usage.input_tokens, 10); assert.equal(r.trust, 'user_skill_catalog'); assert.ok(GATE_ACTION && GATE_NAMED && FIT_MIN);
});
test('portão: pedido sem ação nem nome específico não chega à etapa 2', async t => {
  const { root } = await fixture(t), dir = await external(root, six), calls = [];
  const { request } = scripted({ calls, nouls: { acts: 0.05, procedure: 0.1, prose: 0.95, named: 0.1 } });
  const r = await findSkill(root, 'O que é um PDF?', { skillsDir: dir, key, request });
  assert.equal(r.status, 'none'); assert.equal(r.reason, 'gate'); assert.equal(calls.length, 1); assert.equal(r.requests, 1); assert.ok(r.gate.action < GATE_ACTION);
});
test('sem ajuste: nenhuma skill serve', async t => {
  const { root } = await fixture(t), dir = await external(root, six);
  const r = await findSkill(root, 'Preencher PDF', { skillsDir: dir, key, request: scripted({ fits: { 'pdf-fill': 0.1, 'pdf-merge': 0.1, xlsx: 0.1, docx: 0.1, slides: 0.1, audio: 0.1, rounding: 0.1 } }).request });
  assert.equal(r.status, 'none'); assert.equal(r.reason, 'no_fit'); assert.ok(r.alternatives.length >= 1 && r.alternatives.length <= 3);
});
test('300 skills: duas requisições na etapa 1, só a primeira com as perguntas sim/não', async t => {
  const { root } = await fixture(t), many = {};
  for (let i = 0; i < 300; i++) many['s' + String(i).padStart(3, '0')] = md('s' + i, 'Skill número ' + i);
  const dir = await external(root, many), calls = [];
  const r = await findSkill(root, 'fazer algo', { skillsDir: dir, key, request: scripted({ calls }).request });
  const stage1 = calls.filter(c => !Object.keys(c.questions).some(k => k.startsWith('fits::')));
  assert.equal(stage1.length, 2); assert.equal(stage1.filter(c => c.questions.acts).length, 1);
  assert.deepEqual(stage1.map(c => Object.keys(c.questions.which.criteria).length).sort((a, b) => b - a), [255, 46]);
  assert.equal(r.requests, 3); assert.equal(Object.keys(calls[2].questions.which.criteria).length, 6);
});
test('HTTP 429 e depois 200: sucesso após nova tentativa', async t => {
  const { root } = await fixture(t), dir = await external(root, six), inner = scripted(); let n = 0;
  const request = async (u, o) => ++n === 1 ? new Response('busy', { status: 429 }) : inner.request(u, o);
  const r = await findSkill(root, 'Preencher PDF', { skillsDir: dir, key, request });
  assert.equal(r.status, 'selected'); assert.equal(n, 3);
});
test('HTTP 500: indisponível com candidatas locais', async t => {
  const { root } = await fixture(t), dir = await external(root, six);
  const r = await findSkill(root, 'preencher formulários PDF', { skillsDir: dir, key, request: async () => new Response('segredo do servidor', { status: 500 }) });
  assert.equal(r.status, 'unavailable'); assert.equal(r.http, 500); assert.equal(r.candidates[0].name, 'pdf-fill'); assert.ok(!JSON.stringify(r).includes('segredo'));
});
test('segredos na tarefa são ocultados antes do envio e o registro não guarda conteúdo', async t => {
  const { root } = await fixture(t), dir = await external(root, six), seen = [], inner = scripted();
  const fakeSk = 'sk-' + 'abcdefghij0123456789klmn';
  const task = 'Preencher PDF com token=abcd1234efgh5678 e ' + fakeSk;
  const r = await findSkill(root, task, { skillsDir: dir, key, request: async (u, o) => { seen.push(o.body); return inner.request(u, o); } });
  assert.equal(r.status, 'selected');
  for (const body of seen) { assert.ok(body.includes('[REDACTED]')); assert.ok(!body.includes('abcd1234efgh5678') && !body.includes(fakeSk) && !body.includes(key)); }
  const log = await readFile(resolve(root, '.jev-graphify/sent.jsonl'), 'utf8'), lines = log.trim().split('\n').map(l => JSON.parse(l));
  assert.deepEqual(lines.map(l => l.purpose), ['skill_rank', 'skill_rerank']);
  assert.ok(lines.every(l => l.bytes > 0 && l.redactions === 2 && l.status === 'ok'));
  assert.ok(!log.includes('Preencher') && !log.includes(key) && !log.includes('abcd1234'));
});
