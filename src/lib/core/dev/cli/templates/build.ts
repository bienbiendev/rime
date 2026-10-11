import { productionEnv, renderEnv } from './env.js';

export const envProduction = () => renderEnv(productionEnv());

export const nodeServer = `import { createServer } from 'node:http';
import serveStatic from 'serve-static';
import { handler } from './build/handler.js';

const serve = serveStatic('./static');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';
const siteUrl = new URL(process.env.SITE_URL);

createServer((req, res) => {
	// The request's origin, read by adapter-node through PROTOCOL_HEADER and HOST_HEADER
	req.headers['x-rime-protocol'] = siteUrl.protocol.slice(0, -1);
	req.headers['x-rime-host'] = siteUrl.host;
	serve(req, res, () => {
		// The client already left: adapter-node would throw piping a static file into the closed
		// response, and the throw would take the server down
		if (res.destroyed) return;
		handler(req, res, () => {
			res.statusCode = 404;
			res.end();
		});
	});
}).listen(port, host, () => {
	console.log(\`server running on http://\${host}:\${port}\`);
});
`;
