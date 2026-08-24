// Isomorphic entry — the only file anything imports. Resolves to module.ts (client build)
// or module.server.ts (server build) via the $rime/plugins/cache/module specifier.
export { cache } from '$rime/core/plugins/cache';
