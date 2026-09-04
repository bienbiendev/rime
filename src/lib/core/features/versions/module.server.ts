// Server half. The aliases are built from `collectionHooks`, which is server-only, so there is no
// client half to pair this with — a client build resolves the name to `undefined` and the feature
// simply carries no `configure` there. Same shape as `features/url`'s hooks.
export { makeVersionsCollectionsAliases } from './derive.server.js';
