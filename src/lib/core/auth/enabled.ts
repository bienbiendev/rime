/** A collection signs in by declaring `auth`. */
export const isAuth = (config: { auth?: unknown }): boolean => !!config.auth;
