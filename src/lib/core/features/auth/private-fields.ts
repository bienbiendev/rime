/**
 * The members of an auth document that never leave the server.
 *
 * In a plain file rather than `constant.server.ts`, where it used to live, because
 * `features/auth/index.ts` reaches it now — a feature's `index.ts` is isomorphic (a prototype's
 * `features` list is reachable from a client build), so anything it imports has to be too. The
 * list is inert data; nothing about it needs a server.
 */
export const PRIVATE_FIELDS = [
  'password',
  'token',
  'isSuperAdmin',
  'apiKeyId',
  'authUserId',
  'isStaff'
];
