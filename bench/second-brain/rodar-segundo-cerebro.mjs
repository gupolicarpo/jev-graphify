// Teste do Second Brain + código: o agente pergunta uma vez e deve receber a nota certa e os arquivos de código ligados a ela.
// Uso: node bench/second-brain/rodar-segundo-cerebro.mjs <modo>
//   preparar      copia o faturamento para projeto/, configura o brain e roda o update (Graphify via JEV_GRAPHIFY_PYTHON)
//   jev-ficha     recall com o Second Brain, privacidade "ficha" (envia fichas das notas ao Jev); exige JEV_API_KEY
//   jev-completo  recall com o Second Brain, privacidade "completo" (envia o texto das notas ao Jev); exige JEV_API_KEY
//   local         recall com o Second Brain sem chave (só a ordenação local)
//   base-jev      linha de base SEM o recurso: cofre achatado numa pasta de memória, com chave
//   base-local    linha de base SEM o recurso, sem chave
// O resultado gravado tem pedidos, nomes de nota e números; nunca o texto das notas nem a chave.
import { mkdir, writeFile, readFile, readdir, rm, cp, copyFile, stat } from 'node:fs/promises';
import { resolve, dirname, join, basename, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');
const load = name => import(pathToFileURL(resolve(SRC, name)).href);
const { recall } = await load('memory.mjs');
const { update } = await load('core.mjs');
const { findInProject } = await load('project.mjs');

const vault = resolve(here, 'vault'), origem = resolve(here, 'faturamento');
const projeto = resolve(here, 'projeto'), projetoBase = resolve(here, 'projeto-base'), pastaBase = resolve(here, 'base-memoria');
const MARCADOR = 'MARCADOR-PRIVADO-7731', ROTULO = basename(vault), PRECO_POR_MILHAO = 0.042, BUDGET = 1500;
const MODOS = ['preparar', 'jev-ficha', 'jev-completo', 'local', 'base-jev', 'base-local'];
const modo = process.argv[2];
if (!MODOS.includes(modo)) { console.error('Uso: node rodar-segundo-cerebro.mjs <' + MODOS.join('|') + '>'); process.exit(2); }

const existe = p => stat(p).then(() => true, () => false);

if (modo === 'preparar') {
  await rm(projeto, { recursive: true, force: true });
  await cp(origem, projeto, { recursive: true });
  const cfgPath = resolve(projeto, '.jev-graphify.json');
  const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
  cfg.brain = { exclude: ['Templates'] };
  await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('Projeto copiado para', projeto, '| Graphify:', process.env.JEV_GRAPHIFY_PYTHON ? 'JEV_GRAPHIFY_PYTHON definido' : 'JEV_GRAPHIFY_PYTHON ausente (usa o padrão)');
  const started = performance.now();
  const r = await update(projeto, { brainDirs: [vault] });
  console.log('Resultado do update (' + Math.round(performance.now() - started) + ' ms):\n' + JSON.stringify(r, null, 2));
  process.exit(0);
}

const base = modo.startsWith('base-');
const key = modo.endsWith('-local') || modo === 'local' ? undefined : process.env.JEV_API_KEY;
if (!base && modo !== 'local' && !key) { console.error('Modo ' + modo + ' exige JEV_API_KEY no ambiente.'); process.exit(2); }
if (base && modo === 'base-jev' && !key) { console.error('Modo base-jev exige JEV_API_KEY no ambiente.'); process.exit(2); }
const privacy = modo === 'jev-completo' ? 'completo' : 'ficha';
let cases = JSON.parse(await readFile(resolve(here, 'casos.json'), 'utf8'));
if (process.env.TESTE_MAX) cases = cases.slice(0, Number(process.env.TESTE_MAX));

// Linha de base: o cofre vira uma pasta plana de memórias, sem Templates, .obsidian nem notas privadas.
const mapaBase = new Map();
async function achatar() {
  await rm(pastaBase, { recursive: true, force: true });
  await mkdir(pastaBase, { recursive: true });
  const walk = async dir => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
      const full = join(dir, e.name), rel = relative(vault, full).split(sep).join('/');
      if (e.isDirectory()) { if (rel !== 'Templates') await walk(full); continue; }
      if (!e.name.endsWith('.md')) continue;
      const text = await readFile(full, 'utf8');
      if (/^---\r?\n[\s\S]*?\bprivate:\s*true\b[\s\S]*?\r?\n---/.test(text) || /(^|\s)#private\b/.test(text)) continue;
      const nome = rel.replace(/\//g, '__');
      await copyFile(full, join(pastaBase, nome));
      mapaBase.set(nome, rel);
    }
  };
  await walk(vault);
}

let root;
if (base) { await achatar(); await mkdir(projetoBase, { recursive: true }); root = projetoBase; }
else {
  if (!await existe(resolve(projeto, '.jev-graphify'))) { console.error('Projeto não preparado: rode antes "node rodar-segundo-cerebro.mjs preparar".'); process.exit(2); }
  root = projeto;
}
if (key) console.log('AVISO: JEV_API_KEY encontrada. ' + (privacy === 'completo' && !base ? 'O texto das notas' : 'Fichas e trechos do cofre') + ' (' + (base ? pastaBase : vault) + ') serão enviados ao Jev (TypeSafe). Notas privadas e Templates ficam de fora.');
else console.log('Sem chave: só a ordenação local, nenhuma chamada externa.');

// Caminho da nota relativo ao cofre, a partir do campo source do item.
const caminho = source => {
  if (base) return mapaBase.get(String(source).replace(/^memory\//, '')) ?? String(source);
  return String(source).replace(new RegExp('^brain/' + ROTULO + '/'), '');
};
const rows = [];
for (const c of cases) {
  const opcoes = base ? { memoryDirs: [pastaBase], autoMemory: false, key, budget: BUDGET, privacy } : { brainDirs: [vault], autoMemory: false, key, budget: BUDGET, privacy };
  const started = performance.now();
  const r = await recall(root, c.pedido, opcoes);
  const items = r.items ?? [];
  const got = [...new Set(items.map(i => caminho(i.source)))], first = got[0] ?? 'nenhuma';
  const ponteiros = [...(r.near ?? []), ...(r.related ?? [])].map(n => caminho(n.source));
  const filesCode = new Set([...(r.code ?? []).map(x => x.file ?? x), ...items.flatMap(i => (i.code ?? []).map(x => x.file))]);
  let find = null;
  if (!base && c.codigo.length) find = await findInProject(root, c.pedido, { key, top: 5 });
  const ms = Math.round(performance.now() - started);
  const findItems = find?.items ?? [];
  const row = {
    pedido: c.pedido, tipo: c.tipo, esperado: c.esperado, primeiro: first,
    acertouPrimeiro: first === c.esperado,
    estaNaResposta: c.esperado === 'nenhuma' ? got.length === 0 : got.includes(c.esperado),
    estaNosPonteiros: c.esperado !== 'nenhuma' && ponteiros.includes(c.esperado),
    codigoAcertou: base || !c.codigo.length ? null : c.codigo.some(f => filesCode.has(f)),
    codigoNoFind: base || !c.codigo.length ? null : c.codigo.some(f => findItems.some(i => i.file === f)),
    notasNoFind: base ? null : findItems.filter(i => (i.notes ?? []).length).length,
    vazouPrivado: JSON.stringify(r).includes(MARCADOR) || JSON.stringify(find ?? '').includes(MARCADOR),
    devolvidos: got, ponteiros, codigoDevolvido: [...filesCode],
    tokensDevolvidos: r.returned_tokens_estimate ?? 0, tokensJev: (r.usage?.input_tokens ?? 0) + (find?.usage?.input_tokens ?? 0),
    requisicoes: (r.requests ?? 0) + (find?.requests ?? 0), estrategia: r.strategy ?? null, status: r.status, ms,
  };
  rows.push(row);
  console.log(`${row.estaNaResposta ? (row.acertouPrimeiro ? 'OK   ' : 'OK(2)') : row.estaNosPonteiros ? 'PERTO' : 'ERRO '} ${String(ms).padStart(6)} ms ${String(row.tokensDevolvidos).padStart(5)} tok ${c.tipo.padEnd(15)} cod ${row.codigoAcertou === null ? '-' : row.codigoAcertou ? 's' : 'n'} ${row.vazouPrivado ? 'VAZOU ' : ''}${c.pedido.slice(0, 60)}`);
}

const sum = (list, f) => list.reduce((n, r) => n + r[f], 0), conta = (list, f) => list.filter(r => r[f]).length;
const tipos = [...new Set(rows.map(r => r.tipo))];
const porTipo = Object.fromEntries(tipos.map(t => {
  const l = rows.filter(r => r.tipo === t);
  return [t, { total: l.length, primeiro: conta(l, 'acertouPrimeiro'), naResposta: conta(l, 'estaNaResposta'), soNosPonteiros: l.filter(r => !r.estaNaResposta && r.estaNosPonteiros).length }];
}));
const comCodigo = rows.filter(r => r.codigoAcertou !== null), comFind = rows.filter(r => r.codigoNoFind !== null), nenhuma = rows.filter(r => r.esperado === 'nenhuma');
const resumo = {
  modo, tetoDeTokens: BUDGET, privacidade: privacy, comChave: Boolean(key), pedidos: rows.length, porTipo,
  codigoAcertou: { certos: conta(comCodigo, 'codigoAcertou'), total: comCodigo.length },
  codigoNoFind: { certos: conta(comFind, 'codigoNoFind'), total: comFind.length, comNotas: comFind.filter(r => r.notasNoFind > 0).length },
  nenhumaCertas: { certas: nenhuma.filter(r => r.estaNaResposta).length, total: nenhuma.length },
  vazamentos: conta(rows, 'vazouPrivado'),
  falhasDeServico: rows.filter(r => !['ok', 'none', 'local'].includes(r.status)).length,
  mediaDeTokensDevolvidos: Math.round(sum(rows, 'tokensDevolvidos') / rows.length),
  requisicoes: sum(rows, 'requisicoes'), tokensJev: sum(rows, 'tokensJev'),
  // Preço publicado pela TypeSafe na data do teste: US$ 0,042 por milhão de tokens de entrada.
  custoEstimadoUSD: Number((sum(rows, 'tokensJev') * PRECO_POR_MILHAO / 1e6).toFixed(4)),
  latenciaMediaMs: Math.round(sum(rows, 'ms') / rows.length),
};
console.log('\nResumo:', JSON.stringify(resumo, null, 2));
if (resumo.vazamentos) console.error('ATENÇÃO: ' + resumo.vazamentos + ' resposta(s) contêm o marcador de nota privada.');
const saida = resolve(here, `resultado-${modo}.json`);
await writeFile(saida, JSON.stringify({ quando: new Date().toISOString(), resumo, linhas: rows }, null, 2) + '\n');
console.log('Gravado em', saida);
