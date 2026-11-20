import { start } from './mcp.mjs';
import { optionsFromEnv } from './env.mjs';
const { project, options, error } = optionsFromEnv(process.env, process.argv.slice(2));
if (error) { console.error(error); process.exitCode = 1; } else start(project, options);
