import { randomId } from '$lib/util/random.js';
import { configImportPaths, OUTPUT_DIR } from '../../constants.js';

const PACKAGE = 'rimecms';

export const env = () => `BETTER_AUTH_SECRET=${randomId(32)}
PUBLIC_RIME_URL=http://localhost:5173

# RIME_CACHE_ENABLED=false
# RIME_SMTP_USER=user@mail.com
# RIME_SMTP_PASSWORD=supersecret
# RIME_SMTP_HOST=smtphost.com
# RIME_SMTP_PORT=465

RIME_CACHE_ENABLED=false
RIME_LOG_LEVEL=TRACE
RIME_LOG_TO_FILE=true
RIME_LOG_TO_FILE_MAX_DAYS=1
`;

export const defaultConfig = (name: string) => `
import { Collection, rime } from '$rime/config';
import { text } from '${PACKAGE}/fields';
import { adapterSqlite } from '${PACKAGE}/adapter-sqlite';

const Pages = Collection.create('pages', {
	fields: [text('title').isTitle()]
});

const Medias = Collection.create('medias', {
  upload: true,
	fields: [
    text('alt').required(),
  ]
});

export default rime({
  $adapter: adapterSqlite('${name}.sqlite'),
  collections: [Pages, Medias]
});
`;

export const drizzleConfig = (name: string) => `
import { defineConfig, type Config } from 'drizzle-kit';

export const config: Config = {
  schema: './src/lib/${OUTPUT_DIR}/schema.server.ts',
  out: './db',
  strict: false,
  dialect: 'sqlite',
  dbCredentials: {
    url: './db/${name}.sqlite'
  }
};

export default defineConfig(config);
`;

// Regenerated fresh by rime init every time (setHooks() only skips if the file already
// exists, and `rime clear`/useConfig.js delete it first) — safe to make mode-aware.
export const hooks = () => `import { sequence } from '@sveltejs/kit/hooks';
import { handlers } from '${PACKAGE}/server';
import config from '.${configImportPaths().server.replace('$lib', '/lib')}';

export const handle = sequence(...(await handlers(config)));
`;
