---
'rimecms': patch
---

Fixed: when a `$rime/modules` folder has only `module.ts` or only `module.server.ts`, the missing side now reads `export const { a } = o` and `export * as ns from './x'` as `undefined`, where an import of them failed at link time. An `export * from './x'` in that file is refused with an error that names it: write the names out, `export { a, b } from './x'`.
