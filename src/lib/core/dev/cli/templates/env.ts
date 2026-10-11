import { randomId } from '#lib/util/random.js';
import { CONFIG_DIR, PANEL_ROUTE } from '../../constants.server.js';

/**
 * A group of .env lines: comment lines, then `KEY=value` lines. A key written `# KEY` is written
 * commented out.
 */
export type EnvBlock = { comment?: string[]; values: Record<string, string> };

const panelRoute: EnvBlock = {
  comment: [
    'Panel URL segment (e.g. /panel/...). Change it to hide the panel from',
    'automated CMS-admin scanners — requests to the old segment 404 instead of',
    "revealing a login page. Restart the dev server, or run 'rime generate',",
    'after changing it: both regenerate the panel routes.'
  ],
  values: { RIME_PANEL_ROUTE: PANEL_ROUTE }
};

const smtp: EnvBlock = {
  values: {
    '# SMTP_USER': 'user@mail.com',
    '# SMTP_PASSWORD': 'supersecret',
    '# SMTP_HOST': 'smtphost.com',
    '# SMTP_PORT': '465'
  }
};

/** The .env of a project in development, as `rime init` writes it. */
export const devEnv = (): EnvBlock[] => [
  {
    values: {
      BETTER_AUTH_SECRET: randomId(32),
      SITE_URL: 'http://localhost:5173',
      RIME_CONFIG_DIR: CONFIG_DIR
    }
  },
  panelRoute,
  smtp,
  {
    values: {
      RIME_CACHE_ENABLED: 'false',
      RIME_LOG_LEVEL: 'TRACE',
      RIME_LOG_TO_FILE: 'true',
      RIME_LOG_TO_FILE_MAX_DAYS: '1'
    }
  }
];

/** The .env of a built app, as `rime build -e` and `rime env` write it. */
export const productionEnv = (): EnvBlock[] => [
  { comment: ['BETTER-AUTH'], values: { BETTER_AUTH_SECRET: randomId(32) } },
  {
    comment: ['RIME'],
    values: {
      SITE_URL: 'http://localhost:3000',
      RIME_LOG_LEVEL: 'ERROR',
      RIME_LOG_TO_FILE: 'true',
      RIME_LOG_TO_FILE_MAX_DAYS: '30',
      RIME_CACHE_ENABLED: 'true',
      RIME_CACHE_STRATEGY: 'memory'
    }
  },
  panelRoute,
  smtp,
  {
    comment: [
      'SVELTEKIT ADAPTER-NODE',
      "index.js sends SITE_URL's protocol and host in these headers on every request"
    ],
    values: {
      PROTOCOL_HEADER: 'x-rime-protocol',
      HOST_HEADER: 'x-rime-host',
      PORT: '3000',
      HOST: '127.0.0.1'
    }
  },
  {
    comment: ['MISC'],
    values: { BODY_SIZE_LIMIT: '10485760 # 10(MB) * 1024 * 1024 = 10485760 bytes' }
  }
];

/** `blocks` as .env text, with a blank line between two blocks. */
export const renderEnv = (blocks: EnvBlock[]) =>
  blocks
    .map((block) =>
      [
        ...(block.comment ?? []).map((line) => `# ${line}`),
        ...Object.entries(block.values).map(([key, value]) => `${key}=${value}`)
      ].join('\n')
    )
    .join('\n\n') + '\n';

/**
 * The variables of `blocks` that `content`, an existing .env, does not set, commented out or not.
 * A block keeps its comment when one of its variables is missing.
 */
export const missingEnv = (content: string, blocks: EnvBlock[]): EnvBlock[] =>
  blocks
    .map((block) => ({
      ...block,
      values: Object.fromEntries(
        Object.entries(block.values).filter(([key]) => {
          const name = key.replace(/^# /, '');
          return !new RegExp(`^(#\\s*)?${name}=`, 'm').test(content);
        })
      )
    }))
    .filter((block) => Object.keys(block.values).length > 0);
