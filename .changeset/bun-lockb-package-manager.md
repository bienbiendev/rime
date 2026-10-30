---
'rimecms': patch
---

Fixed: a Bun project that still has its binary `bun.lockb` lockfile, and no `bun.lock`, runs drizzle-kit with `bun drizzle-kit` when the sqlite adapter writes a migration, where it ran `npx drizzle-kit` on Node.
