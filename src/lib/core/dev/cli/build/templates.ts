export const polkaServer = `import polka from 'polka';
import serveStatic from 'serve-static';
import { handler } from './build/handler.js';

const serve = serveStatic('./static');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';

polka()
	.use(serve)
	.use(handler)
	.listen(port, host, () => {
		console.log(\`server running on \${host}:\${port}\`);
	});
`;
