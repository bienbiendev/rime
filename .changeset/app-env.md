---
'rimecms': minor
---

Breaking Change: rime no longer loads `.env` into `process.env`. The app reads its variables from `$app/env/private` and `$app/env/public`, the CLI and the Vite plugin from the env files the way Vite reads them, and the environment always wins over `.env`. A config that reads `process.env.X` gets `undefined` in dev on Node: declare `X` in `src/env.ts` and import it from `$app/env/private`. `PUBLIC_RIME_URL` is renamed `SITE_URL` and `RIME_SMTP_*` are renamed `SMTP_*`; `npx rime init -f` renames them in `.env` and adds every variable rime reads to `src/env.ts`.
