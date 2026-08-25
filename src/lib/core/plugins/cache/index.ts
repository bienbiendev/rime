// Isomorphic entry — the only file anything imports. Resolves to module.ts (client build)
// or module.server.ts (server build) via the $rime/modules barrel.
export { cache } from '$rime/modules';
