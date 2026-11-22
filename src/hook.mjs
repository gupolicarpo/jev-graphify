#!/usr/bin/env node
import { resolve } from 'node:path';
import { mkdir, appendFile } from 'node:fs/promises';
import { optionsFromEnv } from './env.mjs';
import { hash, safePath, hookMode } from './files.mjs';
const MAX_STDIN = 1048576;
async function readInput() {
  const chunks = []; let size = 0;
  for await (const c of process.stdin) { size += c.length; if (size > MAX_STDIN) return null; chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function main() {
  if (process.env.JEV_GRAPHIFY_HOOK === '0') return;
  const input = await readInput();
  const prompt = typeof input?.prompt === 'string' ? input.prompt : '';
  const env = process.env;
  const project = env.JEV_GRAPHIFY_PROJECT || env.CLAUDE_PROJECT_DIR || (typeof input?.cwd === 'string' ? input.cwd : undefined);
  const built = optionsFromEnv({ ...env, ...(project ? { JEV_GRAPHIFY_PROJECT: project } : {}) }, []);
  if (built.error) return;
  const mode = await hookMode(built.project, env);
  if (!mode) return;
  const { contextPack } = await import('./context.mjs');
  const limit = Number(env.JEV_GRAPHIFY_HOOK_TIMEOUT_MS) > 0 ? Number(env.JEV_GRAPHIFY_HOOK_TIMEOUT_MS) : 45000;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), limit);
  let r;
  try { r = await contextPack(built.project, prompt, { ...built.options, contextMode: mode, signal: controller.signal }); }
  finally { clearTimeout(timer); }
  if (r.text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: r.text } }) + '\n');
  try {
    const file = await safePath(built.project, '.jev-graphify/hook.jsonl', true), s = r.stats;
    await mkdir(resolve(file, '..'), { recursive: true });
    await appendFile(file, JSON.stringify({ at: new Date().toISOString(), ms: s.ms, status: r.status, confidence: r.confidence, strategy: r.strategy, promptHash: hash(prompt), promptChars: prompt.length, requests: s.requests, jevInputTokens: s.jevInputTokens, files: s.files, snippets: s.snippets, notes: s.notes, injectedChars: s.injectedChars }) + '\n', { mode: 0o600 });
  } catch {}
}
main().catch(() => {}).finally(() => process.exit(0));
