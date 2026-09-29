import { PANEL_ROUTE } from '$lib/core/routes/constants.server.js';
import { randomId } from '$lib/util/random.js';

export const envProduction = () => `# BETTER-AUTH
BETTER_AUTH_SECRET=${randomId(32)}

# RIME
PUBLIC_RIME_URL=http://localhost:3000
RIME_PANEL_ROUTE=${PANEL_ROUTE}
RIME_LOG_LEVEL=ERROR
RIME_LOG_TO_FILE=true
RIME_CACHE_ENABLED=true
RIME_CACHE_STRATEGY=memory

# RIME_SMTP_USER=user@host.org
# RIME_SMTP_PASSWORD=somepassword
# RIME_SMTP_HOST=smtp.host
# RIME_SMTP_PORT=465

# SVELTEKIT ADAPTER-NODE
ORIGIN=http://localhost:3000
PORT=3000
HOST=localhost

# MISC
BODY_SIZE_LIMIT=10485760 # 10(MB) * 1024 * 1024 = 10485760 bytes
`;

export const nodeServer = `import { createServer } from 'node:http';
import serveStatic from 'serve-static';
import { handler } from './build/handler.js';

const serve = serveStatic('./static');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';
const protocol = process.env.ORIGIN?.startsWith('https') ? 'https' : 'http';

createServer((req, res) => {
	serve(req, res, () => handler(req, res, () => {
		res.statusCode = 404;
		res.end();
	}));
}).listen(port, host, () => {
	console.log(\`server running on \${protocol}://\${host}:\${port}\`);
});
`;

/**
 * `rime build` entry for the Bun pack. svelte-adapter-bun's own `build/index.js`, plus `./static`:
 * the adapter only serves the `build/client` copy made at build time, and uploads land in
 * `./static` while the app runs — what serve-static does in `nodeServer`.
 */
export const bunServer = `import { stat } from 'node:fs/promises';
import path from 'node:path';
import { getHandler } from './build/handler.js';

const { fetch: handle, websocket } = getHandler();
const env = process.env; // Bun loads ./.env itself
const staticDir = path.resolve('static');

async function serveStatic(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return null;
  }
  const file = path.resolve(staticDir, '.' + pathname);
  if (!file.startsWith(staticDir + path.sep)) return null;
  const info = await stat(file).catch(() => null);
  return info?.isFile() ? new Response(Bun.file(file)) : null;
}

const units = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
const limit = env.BODY_SIZE_LIMIT || '512K';
const unit = units[limit.at(-1).toUpperCase()];
const bodySizeLimit = unit ? Number(limit.slice(0, -1)) * unit : Number(limit);

const server = Bun.serve({
  hostname: env.HOST || '0.0.0.0',
  port: env.PORT || 3000,
  idleTimeout: parseInt(env.IDLE_TIMEOUT || '10'),
  maxRequestBodySize: bodySizeLimit,
  async fetch(request, srv) {
    return (await serveStatic(request)) ?? handle(request, srv);
  },
  ...(websocket ? { websocket } : {})
});

console.log(\`server running on \${server.url}\`);
`;
