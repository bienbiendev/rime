# Contributing

You can contribute to this project in many ways :

- adding tests
- improving [documentation](https://github.com/bienbiendev/rime-doc/tree/master/docs)
- adding features
- adding translation for the panel in your language
- make it work for .js only
- try other Sveltekit adapters and adjust the build command to handle these.

## Clone the repo

```bash
git clone https://github.com/bienbiendev/rime.git
```

## Install deps

```bash
cd rime
bun install
```

> Note : I am using `bun` because pnpm's dependency hoisting breaks type declaration generation at build time (nested transitive types, like `zod`'s, become impossible for TypeScript to name portably), and because it lets CLI commands run straight from their `.ts` files, with no separate compile step.

## Add your .env file

```bash
BETTER_AUTH_SECRET=supersecret

PUBLIC_RIME_URL=http://localhost:5173
RIME_CACHE_ENABLED=false
RIME_LOG_LEVEL=TRACE
RIME_LOG_TO_FILE=true
RIME_LOG_TO_FILE_MAX_DAYS=1

# RIME_SMTP_USER=
# RIME_SMTP_PASSWORD=
# RIME_SMTP_HOST=
# RIME_SMTP_PORT=
```

## Init & run

```bash
bunx svelte-kit sync
bun ./src/lib/core/dev/cli/index.ts init
bun run dev
```

## Configuration

[Configuration Overview](https://github.com/bienbiendev/rime-doc/blob/master/docs/03-configuration/00-overview.md)

## Use a predifined config as a starting point

```bash
bun run rime:use basic
```

Available names are `empty`, `basic`, `multilang`, `versions`, `versions-multilang`, respective config live inside the /tests directory.

## CLI commands

Sanitize config, and generates schema, types, routes

```bash
bun ./src/lib/core/dev/cli/index.ts generate
bun ./src/lib/core/dev/cli/index.ts generate --force
```

Clear all rime related files

```bash
bun ./src/lib/core/dev/cli/index.ts clear
bun ./src/lib/core/dev/cli/index.ts clear --force
```

Build the project with adapter-node

```bash
bun ./src/lib/core/dev/cli/build.ts build
# Also copy database to the app folder
bun ./src/lib/core/dev/cli/build.ts build -d
# Also add a .env file to the app folder
bun ./src/lib/core/dev/cli/build.ts build -e
```
