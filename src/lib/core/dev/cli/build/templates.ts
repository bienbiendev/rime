import { PANEL_ROUTE } from '$lib/core/dev/constants.js';
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
