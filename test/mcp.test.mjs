import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fixture, cleanup } from './helpers.mjs';
const json = async file => JSON.parse(await readFile(resolve(file), 'utf8'));
// O servidor fecha antes de a pasta do fixture ser apagada: o Windows não apaga pasta em uso por processo vivo,
// e um servidor que sobra mantém o `node --test` preso.
const closing = (t, root, stop) => t.after(async () => { try { await stop(); } finally { await cleanup(root); } });
test('cliente MCP real negocia, lista e chama ferramentas via stdio', async t => {
  const { root } = await fixture();
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('src/cli.mjs'), 'mcp', '--project', root, '--no-auto-memory', '--all-tools'], stderr: 'pipe' });
  const client = new Client({ name: 'fixture-client', version: '1.0.0' }); closing(t, root, () => client.close());
  await client.connect(transport);
  assert.equal(client.getServerVersion().version, (await json('package.json')).version);
  const list = await client.listTools(); assert.equal(list.tools.length, 9);
  const status = await client.callTool({ name: 'memory_status', arguments: {} });
  assert.equal(JSON.parse(status.content[0].text).status, 'current');
  const result = await client.callTool({ name: 'memory_search', arguments: { query: 'Aurora' } });
  assert.equal(JSON.parse(result.content[0].text).candidates[0].source, 'policy.md');
  const recalled = JSON.parse((await client.callTool({ name: 'memory_recall', arguments: { query: 'Aurora' } })).content[0].text);
  assert.equal(recalled.status, 'local'); assert.ok(recalled.items.some(x => x.source === 'policy.md'));
  const paid = await client.callTool({ name: 'jev_route', arguments: { task: 'Corrigir faturas' } });
  assert.equal(JSON.parse(paid.content[0].text).skill.status, 'disabled');
  const skill = await client.callTool({ name: 'skill_find', arguments: { task: 'Corrigir faturas' } });
  assert.equal(JSON.parse(skill.content[0].text).status, 'disabled');
  const found = JSON.parse((await client.callTool({ name: 'project_find', arguments: { query: 'Aurora' } })).content[0].text);
  assert.equal(found.status, 'not_configured');
  const forbidden = await client.callTool({ name: 'memory_search', arguments: { query: 'Aurora', project: '../other' } });
  assert.equal(forbidden.isError, true);
});
test('compatibilidade de protocolo MCP 2025-11-25 sem modelo nem conta', async t => {
  const { root } = await fixture();
  const child = spawn(process.execPath, [resolve('src/cli.mjs'), 'mcp', '--project', root], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const exited = new Promise(done => child.once('exit', done));
  closing(t, root, () => { child.kill(); return exited; });
  let buffer = ''; const waits = new Map();
  child.stdout.on('data', chunk => { buffer += chunk; let i; while ((i = buffer.indexOf('\n')) >= 0) { const msg = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1); waits.get(msg.id)?.(msg); } });
  function request(msg) { return new Promise((resolveRequest, reject) => { const timer = setTimeout(() => reject(Error('MCP timeout')), 10000); waits.set(msg.id, r => { clearTimeout(timer); resolveRequest(r); }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n'); }); }
  const init = await request({ id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-fixture', version: '1' } } });
  assert.equal(init.result.protocolVersion, '2025-11-25');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = await request({ id: 2, method: 'tools/list', params: {} }); assert.deepEqual(list.result.tools.map(x => x.name).sort(), ['memory_recall', 'memory_status', 'memory_update', 'project_find', 'skill_find']);
  assert.ok(list.result.tools.every(x => x.description.length <= 200));
  const call = await request({ id: 3, method: 'tools/call', params: { name: 'memory_status', arguments: {} } }); assert.equal(JSON.parse(call.result.content[0].text).status, 'current');
  child.stdin.end();
});
test('iniciador de plugin usa a pasta atual quando o host não passa variável', async t => {
  const { root } = await fixture();
  const env = { ...process.env }; delete env.JEV_GRAPHIFY_PROJECT; delete env.CLAUDE_PROJECT_DIR;
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('src/plugin.mjs')], cwd: root, env, stderr: 'pipe' });
  const client = new Client({ name: 'plugin-fixture', version: '1.0.0' }); closing(t, root, () => client.close());
  await client.connect(transport);
  const status = await client.callTool({ name: 'memory_status', arguments: {} });
  assert.equal(JSON.parse(status.content[0].text).status, 'current');
});
test('iniciador de plugin: --all-tools e JEV_GRAPHIFY_ALL_TOOLS ligam as nove ferramentas', async t => {
  for (const [args, extra] of [[['--all-tools'], {}], [[], { JEV_GRAPHIFY_ALL_TOOLS: '1' }]]) {
    const { root } = await fixture();
    const env = { ...process.env, ...extra }; delete env.JEV_GRAPHIFY_PROJECT; delete env.CLAUDE_PROJECT_DIR;
    const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('src/plugin.mjs'), ...args], cwd: root, env, stderr: 'pipe' });
    const client = new Client({ name: 'plugin-fixture', version: '1.0.0' }); closing(t, root, () => client.close());
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 9);
  }
});
test('a versão é a mesma em todos os manifestos', async () => {
  const { version } = await json('package.json'), lock = await json('package-lock.json');
  for (const file of ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) assert.equal((await json(file)).version, version, file);
  assert.equal(lock.version, version); assert.equal(lock.packages[''].version, version);
});
