import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  SITE_URL: { public: true },
  BETTER_AUTH_SECRET: {},
  RIME_PANEL_ROUTE: { schema: (value) => value ?? 'panel' },
  RIME_LOG_LEVEL: { schema: (value) => value ?? 'INFO' },
  RIME_LOG_TO_FILE: { schema: (value) => value === 'true' },
  RIME_LOG_TO_FILE_MAX_DAYS: { schema: (value) => Number(value ?? 30) },
  RIME_CACHE_ENABLED: { schema: (value) => value === 'true' },
  RIME_CACHE_STRATEGY: { schema: (value) => value ?? 'memory' },
  SMTP_HOST: { schema: (value) => value },
  SMTP_PORT: { schema: (value) => Number(value ?? 465) },
  SMTP_USER: { schema: (value) => value },
  SMTP_PASSWORD: { schema: (value) => value }
});
