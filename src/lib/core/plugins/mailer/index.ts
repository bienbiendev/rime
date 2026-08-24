// Server-only, no client half — kept for consistency with every other plugin (module.server.ts
// + isomorphic index.ts), even without a module.ts to pair it with.
export { mailer } from '$rime/core/plugins/mailer';
