import { lstat, realpath, readFile, mkdir, writeFile, rename, appendFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
// Os erros dizem qual caminho falhou: a configuração pode listar até 100.
const shown = file => typeof file === 'string' ? file.slice(0, 200) : '(not text)';
export function checkPath(file, internal = false) {
  if (typeof file !== 'string' || !file || file.includes('\\') || file.includes(':') || isAbsolute(file) || file.split('/').some(p => !p || p === '..' || p === '.' || (!internal && p.startsWith('.')))) throw Error('Invalid or private relative path: ' + shown(file));
  if (!internal && /(?:^|\/)(?:node_modules|graphify-out|config|vault|secrets?|credentials)(?:\/|\.|$)|\.(?:pem|key|pfx|env)$/i.test(file)) throw Error('Private or generated file cannot enter memory: ' + shown(file));
  return file;
}
export async function safePath(root, file, internal = false) {
  checkPath(file, internal);
  const base = await realpath(root);
  let path = base;
  for (const part of file.split('/')) {
    path = resolve(path, part);
    try { if ((await lstat(path)).isSymbolicLink()) throw Error('Symbolic links are not allowed.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const rel = relative(base, path);
  if (isAbsolute(rel) || rel.startsWith('..')) throw Error('Path outside the project.');
  return path;
}
export async function textFile(root, file, internal = false, max = 131072) {
  const path = await safePath(root, file, internal);
  const st = await lstat(path);
  if (!st.isFile() || st.size > max) throw Error('Invalid file or too large (limit ' + Math.round(max / 1024) + ' KB): ' + shown(file));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path)); }
  catch (e) { if (e.code === 'ERR_ENCODING_INVALID_ENCODED_DATA') throw Error('File is not UTF-8 (save it as UTF-8): ' + shown(file)); throw e; }
}
export async function atomicJson(root, file, value) {
  const path = await safePath(root, file, true);
  await mkdir(dirname(path), { recursive: true });
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, path);
}
// Registro do que saiu para o serviço externo: só contagens, nunca conteúdo. Falha aqui não pode derrubar a ferramenta.
export async function appendSendLog(root, entry) {
  try {
    const file = await safePath(root, '.jev-graphify/sent.jsonl', true);
    await mkdir(dirname(file), { recursive: true });
    const big = await lstat(file).then(st => st.size > 1048576, () => false);
    const now = new Date().toISOString(), line = JSON.stringify({ at: now, ...entry }) + '\n';
    // Ao truncar, uma linha 'carry' guarda o total do dia para o teto diário sobreviver à rotação.
    if (big) await writeFile(file, JSON.stringify({ at: now, purpose: 'carry', input_tokens: await usedToday(root) }) + '\n' + line, { mode: 0o600 }); else await appendFile(file, line, { mode: 0o600 });
  } catch {}
}
// Soma dos input_tokens enviados ao Jev hoje (UTC), lida do registro de envios.
export async function usedToday(root) {
  let text;
  try { text = await readFile(await safePath(root, '.jev-graphify/sent.jsonl', true), 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return 0; throw e; }
  const day = new Date().toISOString().slice(0, 10); let total = 0;
  for (const line of text.split('\n')) {
    try { const e = JSON.parse(line); if (typeof e?.at === 'string' && e.at.startsWith(day) && Number.isFinite(e.input_tokens) && e.input_tokens > 0) total += e.input_tokens; } catch {}
  }
  return total;
}
// Privacidade do que vai ao Jev: opção explícita > chave "privacy" do .jev-graphify.json > "ficha" (o padrão não envia texto).
export async function privacyOf(root, options = {}) {
  let p = options.privacy;
  if (p === undefined) {
    try { p = JSON.parse(await textFile(root, '.jev-graphify.json', true, 32768))?.privacy; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  p ??= 'ficha';
  if (!['completo', 'ficha'].includes(p)) throw Error('Invalid privacy: use completo or ficha.');
  return p;
}
export async function jevGate(root, options = {}) {
  if (options.jev === false) return { jev: false, reason: 'turned_off' };
  if (!options.key) return { jev: false, reason: 'no_key' };
  const limit = options.dailyTokens ?? 250000000;
  if (!Number.isSafeInteger(limit) || limit < 0) throw Error('Invalid daily limit: use an integer greater than or equal to zero.');
  if (limit > 0) { const used = await usedToday(root); if (used >= limit) return { jev: false, reason: 'daily_limit', daily: { used, limit } }; }
  return { jev: true };
}
