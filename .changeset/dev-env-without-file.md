---
'rimecms': patch
---

Fixed: `vite dev` starts without a `.env` file when `SITE_URL` and `BETTER_AUTH_SECRET` come from the environment, as in Docker or CI. It checks those two variables, wherever they are set, where it refused to start with `Missing .env file`.
