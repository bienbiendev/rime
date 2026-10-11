// Server half only. A client build resolves `configureVersions` to `undefined`, and
// `configureConfig` skips it.
export { configureVersions } from './configure.server.js';
