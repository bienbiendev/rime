---
'rimecms': patch
---

Changed: a log line is `22:56:00.031 message`, written in order to one file per local day. A request line carries its status, `200 GET /panel/pages`, coloured by status on the terminal; in dev it goes to the file only, as SvelteKit prints every response itself. A warning starts with `[warn]`, an error with `[error]`, coloured on the terminal, and an error is printed with its stack. The CLI, codegen and schema steps log at `debug`, which the CLI always shows.
