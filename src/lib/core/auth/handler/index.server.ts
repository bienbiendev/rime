import { ROLES } from '#lib/core/auth/constant.js';
import { dev } from '$app/env';
import { RimeError } from '#lib/core/errors/index.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';
import type { Config, User } from '#lib/types.js';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { access } from '#lib/core/auth/access.js';
import { BETTER_AUTH_ROLES } from '#lib/core/auth/constant.server.js';
import { apiKeyUser, userAttributes } from '#lib/core/auth/user.server.js';
import { authUserRole, hasAuthUser } from '#lib/core/auth/better-auth-tables.server.js';
import type { ConfigContext, RimeContext } from '#lib/core/rime.server.js';

interface AuthResult {
  session: any;
  user: any;
}

interface UserData {
  user: User;
  session: any;
  authUser: any;
}

/**
 * Ensures panel is properly set up before allowing access
 */
async function ensureFirstAuthSetup<C extends Config>(rime: RimeContext<C>): Promise<void> {
  if (!(await hasAuthUser(rime.adapter)) && !dev) {
    throw new RimeError(RimeError.NOT_FOUND);
  }
}

/**
 * Authenticates the request using better-auth
 */
async function authenticateRequest(
  headers: Headers,
  // Typed by what this uses, not by the whole instance. `RimeContext['auth']` resolves to
  // `RimeAuth<Config>`, and a better-auth instance varies with the plugins its config declared,
  // so the one a real request carries is not assignable to that base. Making the helper generic
  // does not help either — `RimeContext<C>['auth']` has no resolved `api` while `C` is unbound.
  // Naming the one call it makes keeps the plugin typing intact everywhere it matters and asks
  // for nothing here that this function does not actually need.
  auth: { api: { getSession(args: { headers: Headers }): Promise<AuthResult | null> } }
): Promise<AuthResult | null> {
  return await auth.api.getSession({ headers });
}

/**
 * Handles unauthenticated users based on route requirements
 */
function handleUnauthenticated(event: RequestEvent, resolve: any): any {
  const { isPanel, panelUrl } = event.locals.rime.routes;

  if (isPanel) {
    throw redirect(303, panelUrl('sign-in'));
  }

  event.locals.user = undefined;
  event.locals.session = undefined;
  return resolve(event);
}

/**
 * Validates admin roles consistency between better-auth and CMS
 */
function validateAdminRoles(user: any, authUser: any): void {
  if (user.roles.includes(ROLES.ADMIN) && authUser.role !== BETTER_AUTH_ROLES.ADMIN) {
    throw error(401, RimeError.UNAUTHORIZED);
  }
}

/**
 * The slice of better-auth this file needs for api keys — see apiKeyUserData. `verifyApiKey`
 * answers the stored key without its hash; `referenceId` is the better-auth user that made it.
 */
type ApiKeyVerifier = {
  api: {
    verifyApiKey(args: { body: { key: string } }): Promise<{
      valid: boolean;
      key?: {
        id: string;
        referenceId: string;
        permissions?: { roles: string[] } | null;
      } | null;
    }>;
  };
};

/**
 * Who a request carrying `x-api-key` is: the key's document, with the key's roles. A key that
 * does not verify, whose document is gone, or that carries `admin` while the better-auth user
 * that made it is not a better-auth admin, answers 401.
 */
async function apiKeyUserData<C extends Config>(
  apiKey: string,
  rime: RimeContext<C>
): Promise<UserData> {
  // The narrowing is local and deliberate: `C` is still an unbound type parameter here, so
  // better-auth's `api` — which is built from the plugin list a config declares — has nothing
  // concrete to offer yet. The api-key plugin is always in the base config, so the call is sound;
  // it just cannot be proven from inside a function generic over every config.
  const auth = rime.auth as unknown as ApiKeyVerifier;
  const result = await auth.api.verifyApiKey({ body: { key: apiKey } });
  if (!result.valid || !result.key?.permissions) {
    throw error(401, RimeError.UNAUTHORIZED);
  }

  const slugs = rime.config.raw.collections
    .filter((collection) => collection.auth?.type === 'apiKey')
    .map((collection) => collection.slug as CollectionSlug);
  const user = await apiKeyUser(rime.adapter, {
    slugs,
    apiKeyId: result.key.id,
    roles: result.key.permissions.roles
  });
  if (!user) {
    throw error(401, RimeError.UNAUTHORIZED);
  }

  // The same check a session's roles pass, against the better-auth user that made the key
  const role = await authUserRole(rime.adapter, { authUserId: result.key.referenceId });
  validateAdminRoles(user, { role });

  return { user, session: undefined, authUser: undefined };
}

/**
 * Builds complete user data by combining auth and CMS information. Undefined when the user's
 * document is gone: better-auth still knows them, rime does not.
 */
async function buildUserData<C extends Config>(
  authResult: AuthResult,
  rime: RimeContext<C>
): Promise<UserData | undefined> {
  const { session, user: authUser } = authResult;

  const user = await userAttributes(rime.adapter, {
    authUserId: authUser.id,
    slug: authUser.type as CollectionSlug
  });
  if (!user) return undefined;

  // Validate admin roles consistency
  validateAdminRoles(user, authUser);

  return { user, session, authUser };
}

/**
 * Applies authorization rules based on route and user data
 */
function authorizePanelUser<C extends Config>(
  userData: UserData,
  isPanel: boolean,
  config: ConfigContext<C>
): void {
  const { user } = userData;

  // Panel-specific authorization
  if (isPanel) {
    // Do not allow non-staff user on panel
    if (!user.isStaff) {
      throw error(401, RimeError.UNAUTHORIZED);
    }
    // Without `panel.$access`, only admins enter the panel.
    const panelAccess = config.raw.panel.$access ?? ((u?: User) => access.isAdmin(u));
    if (!panelAccess(user)) {
      throw error(401, RimeError.UNAUTHORIZED);
    }
  }
}

/**
 * Sets `event.locals.user`, `session` and `betterAuthUser`, then resolves the request.
 */
function setupLocalsAndResolve(event: any, resolve: any, userData: UserData): any {
  const { user, session, authUser } = userData;

  event.locals.user = user;
  event.locals.session = session || undefined;
  event.locals.betterAuthUser = authUser;

  return resolve(event);
}

/**
 * Authenticates the request, checks panel access and sets the user on `event.locals`.
 */
export const handleAuth: Handle = async ({ event, resolve }) => {
  const rime = event.locals.rime;
  const { isPanel } = rime.routes;

  // Ensure auth is set up
  if (isPanel) {
    await ensureFirstAuthSetup(rime);
  }

  // A request carrying a key is the key's request, whatever session comes with it
  const apiKey = event.request.headers.get('x-api-key');
  if (apiKey) {
    const userData = await apiKeyUserData(apiKey, rime);
    authorizePanelUser(userData, isPanel, rime.config);
    return setupLocalsAndResolve(event, resolve, userData);
  }

  // Authenticate the request
  const authResult = await authenticateRequest(event.request.headers, rime.auth);
  const userData = authResult && (await buildUserData(authResult, rime));

  // No session, or a session whose document is gone: anonymous
  if (!userData) {
    return handleUnauthenticated(event, resolve);
  }

  // Apply panel authorization rules
  authorizePanelUser(userData, isPanel, rime.config);

  // Set up locals and resolve
  return setupLocalsAndResolve(event, resolve, userData);
};
