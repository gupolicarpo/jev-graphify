// Confere a consistência do conjunto: casos, caminhos de código, símbolos citados nas notas, links e notas privadas.
// Uso: node bench/second-brain/verificar-conjunto.mjs
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), vault = resolve(here, 'vault'), code = resolve(here, 'faturamento');
const walk = (dir, pred, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== '__pycache__') walk(p, pred, out); } else if (pred(p)) out.push(p);
  }
  return out;
};
const norm = p => relative(vault, p).split('\\').join('/');
const pyFiles = walk(code, p => p.endsWith('.py')).map(p => relative(code, p).split('\\').join('/'));
const codeText = pyFiles.map(f => readFileSync(join(code, f), 'utf8')).join('\n');
const idents = new Set(codeText.match(/[A-Za-z_][A-Za-z0-9_]*/g));
const problemas = [];
const erro = (onde, msg) => problemas.push(onde + ': ' + msg);

const notas = walk(vault, p => p.endsWith('.md')).map(p => ({ rel: norm(p), text: readFileSync(p, 'utf8') }));
const rels = new Set(notas.map(n => n.rel));
const porNome = new Map(), porAlias = new Map();
const fm = text => { const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/); return m ? m[1] : ''; };
for (const n of notas) {
  porNome.set(basename(n.rel, '.md').toLowerCase(), n.rel);
  const a = fm(n.text).match(/^aliases:\s*\[(.*)\]/m);
  if (a) for (const x of a[1].split(',')) porAlias.set(x.trim().replace(/^["']|["']$/g, '').toLowerCase(), n.rel);
}
const resolveLink = alvo => {
  const t = alvo.split('#')[0].split('|')[0].trim().toLowerCase();
  return porNome.get(t) ?? porAlias.get(t) ?? [...rels].find(r => r.toLowerCase().replace(/\.md$/, '').endsWith(t));
};
const pathExiste = p => pyFiles.includes(p) || pyFiles.some(f => f.endsWith('/' + p));
let wikilinks = 0, mdlinks = 0, spans = 0, fmCode = 0, comFm = 0, orfas = 0;
for (const n of notas) {
  const sem = n.text.replace(/```[\s\S]*?```/g, '');
  if (fm(n.text)) comFm++;
  if (!fm(n.text) && !/\[\[/.test(sem)) orfas++;
  if (n.rel.startsWith('Templates/')) continue;
  for (const m of sem.matchAll(/\[\[([^\]]+)\]\]/g)) { wikilinks++; if (!resolveLink(m[1])) erro(n.rel, 'wikilink sem alvo: [[' + m[1] + ']]'); }
  for (const m of fm(n.text).matchAll(/(?:superseded_by|supersedes):\s*"\[\[([^\]]+)\]\]"/g)) if (!resolveLink(m[1])) erro(n.rel, 'frontmatter sem alvo: ' + m[1]);
  for (const m of sem.matchAll(/\]\(([^)]+\.md)\)/g)) { mdlinks++; if (!rels.has(norm(resolve(vault, dirname(n.rel), decodeURIComponent(m[1]))))) erro(n.rel, 'link markdown quebrado: ' + m[1]); }
  // code: do frontmatter (inline [a, b] ou lista em bloco)
  const f = fm(n.text), inline = f.match(/^code:\s*\[(.*)\]/m), bloco = f.match(/^code:\s*\n((?:\s+-\s*.+\n?)+)/m);
  const lista = inline ? inline[1].split(',').map(s => s.trim()).filter(Boolean) : bloco ? [...bloco[1].matchAll(/-\s*(.+)/g)].map(x => x[1].trim()) : [];
  for (const p of lista) { fmCode++; if (!pathExiste(p)) erro(n.rel, 'code do frontmatter inexistente: ' + p); }
  // spans de código inline no corpo
  const corpo = sem.replace(/^---[\s\S]*?\n---/, '');
  for (const m of corpo.matchAll(/`([^`\n]+)`/g)) {
    const s = m[1].trim().replace(/\(\)$/, '');
    if (/\s/.test(s)) continue;
    if (/\.(py|mjs|js|json)$/.test(s)) { spans++; if (!pathExiste(s)) erro(n.rel, 'arquivo citado inexistente: ' + s); continue; }
    if (/^[\w.]+$/.test(s) && (/_/.test(s) || /[a-z][A-Z]/.test(s) || /^[A-Z][a-z]+[A-Z]/.test(s) || /^[A-Z][a-z]+\.[a-z]/.test(s))) {
      spans++;
      for (const parte of s.split('.')) if (!idents.has(parte)) erro(n.rel, 'símbolo citado inexistente: ' + s);
    }
  }
}
// pastas de código citadas em texto livre (ex.: billing/rounding.py fora de backticks)
for (const n of notas) for (const m of n.text.matchAll(/\b((?:billing|taxes|payments|customers|reports|notifications|auth|integrations\/erp|jobs|api)\/[\w]+\.py)/g)) if (!pathExiste(m[1])) erro(n.rel, 'caminho no texto inexistente: ' + m[1]);

// casos
const casos = JSON.parse(readFileSync(resolve(here, 'casos.json'), 'utf8')), tipos = {};
for (const [i, c] of casos.entries()) {
  tipos[c.tipo] = (tipos[c.tipo] ?? 0) + 1;
  if (c.esperado !== 'nenhuma' && !rels.has(c.esperado)) erro('caso ' + (i + 1), 'esperado inexistente: ' + c.esperado);
  if (c.esperado === 'nenhuma' && c.codigo.length) erro('caso ' + (i + 1), 'nenhuma com código');
  for (const p of c.codigo) if (!pyFiles.includes(p)) erro('caso ' + (i + 1), 'código inexistente: ' + p);
  if (!['parafrase', 'direto', 'substituida', 'codigo-via-nota', 'nenhuma', 'pessoal'].includes(c.tipo)) erro('caso ' + (i + 1), 'tipo inválido');
}
// notas privadas
const marcador = notas.filter(n => n.text.includes('MARCADOR-PRIVADO-7731'));
const privadas = notas.filter(n => /^private:\s*true/m.test(fm(n.text)) || /(^|\s)#private\b/.test(n.text.replace(/```[\s\S]*?```/g, '')));
if (marcador.length !== 3 || privadas.length !== 3 || marcador.some(n => !privadas.includes(n))) erro('privadas', 'esperava 3 notas privadas com o marcador; achei ' + marcador.length + ' com marcador e ' + privadas.length + ' privadas');
// tamanho
const palavras = n => n.text.replace(/^---[\s\S]*?\n---/, '').split(/\s+/).filter(Boolean).length;
const fora = notas.filter(n => !n.rel.startsWith('Templates/') && !n.rel.startsWith('Diário/') && (palavras(n) < 40 || palavras(n) > 450));
const supersedidas = notas.filter(n => /^status:\s*superseded/m.test(fm(n.text)));
for (const n of supersedidas) if (!/superseded_by:\s*"\[\[/.test(fm(n.text))) erro(n.rel, 'superseded sem superseded_by');

const porPasta = {};
for (const n of notas) { const p = n.rel.includes('/') ? n.rel.split('/')[0] : '(raiz)'; porPasta[p] = (porPasta[p] ?? 0) + 1; }
console.log('arquivos de código .py:', pyFiles.length, '(sem __init__:', pyFiles.filter(f => !f.endsWith('__init__.py')).length + ')');
console.log('notas:', notas.length, JSON.stringify(porPasta));
console.log('com frontmatter:', comFm, '| sem frontmatter e sem links:', orfas, '| superseded:', supersedidas.length);
console.log('wikilinks:', wikilinks, '| links markdown:', mdlinks, '| menções de código checadas:', spans, '| paths em code:', fmCode);
console.log('casos:', casos.length, JSON.stringify(tipos));
console.log('notas privadas com marcador:', marcador.length, '| notas fora de 40–450 palavras (exceto Diário/Templates):', fora.length, fora.map(n => n.rel + ' (' + palavras(n) + ')').join('; '));
const diarias = notas.filter(n => n.rel.startsWith('Diário/')).map(palavras);
console.log('Diário: ' + diarias.length + ' notas, palavras min/máx/média = ' + Math.min(...diarias) + '/' + Math.max(...diarias) + '/' + Math.round(diarias.reduce((a, b) => a + b, 0) / diarias.length));
console.log(problemas.length ? 'PROBLEMAS (' + problemas.length + '):\n' + problemas.join('\n') : 'OK: nenhum problema encontrado.');
process.exit(problemas.length ? 1 : 0);
