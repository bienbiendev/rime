// Isomorphic entry — the only file anything imports. Resolves to module.ts (client build) or
// module.server.ts (server build) via `$rime/modules:`.
export { defaultPlugins } from '$rime/modules:core/plugins/defaults';
