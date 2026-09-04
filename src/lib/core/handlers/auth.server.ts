import { isPublicPanelAuthRoute } from '$lib/core/constants.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import type { Config, User } from '$lib/types.js';
import { error, redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { access } from '$lib/util/index.js';
import { BETTER_AUTH_ROLES } from '../features/auth/constant.server.js';
import { logger } from '../logger.server.js';
import type { ConfigContext, RimeContext } from '../rime.server.js';

const dev = process.env.NODE_ENV === 'development';

interface RouteInfo {
  isPublicAuthRoute: boolean;
  isPanel: boolean;
  isAPI: boolean;
}

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
 * Analyzes the current route to determine authentication requirements.
 * isPanel/isPublicAuthRoute are derived from the matched route, not the
 * pathname — event.params.panel only resolves when the request matched the
 * [panel=panel] matcher, and event.route.id's literal folder names never
 * carry the configured RIME_PANEL_ROUTE value — so neither check needs to
 * know the actual (hideable) panel segment. sign-in/forgot-password/reset-password
 * all live under [panel=panel] too but must stay reachable without a session,
 * hence the isPublicAuthRoute carve-out.
 */
function analyzeRoute(event: RequestEvent): RouteInfo {
  const isPublicAuthRoute = isPublicPanelAuthRoute(event.route.id);
  const isPanel = event.params.panel !== undefined && !isPublicAuthRoute;
  const isAPI = event.url.pathname.startsWith('/api');

  return { isPublicAuthRoute, isPanel, isAPI };
}

/**
 * Ensures panel is properly set up before allowing access
 */
async function ensureFirstAuthSetup<C extends Config>(rime: RimeContext<C>): Promise<void> {
  if (!(await rime.adapter.auth.hasAuthUser()) && !dev) {
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
function handleUnauthenticated(event: RequestEvent, resolve: any, routeInfo: RouteInfo): any {
  if (routeInfo.isPanel) {
    throw redirect(303, `/${event.params.panel}/sign-in`);
  }

  event.locals.user = undefined;
  event.locals.session = undefined;
  return resolve(event);
}

/**
 * Gets CMS user attributes for the authenticated user
 */
async function getCmsUserAttributes<C extends Config>(
  authUserId: string,
  userType: string,
  rime: RimeContext<C>
): Promise<any> {
  const user = await rime.adapter.auth.getUserAttributes({
    authUserId,
    slug: userType as CollectionSlug
  });

  if (!user) {
    logger.error(RimeError.UNAUTHORIZED);
    throw error(401, RimeError.UNAUTHORIZED);
  }

  return user;
}

/**
 * Validates admin roles consistency between better-auth and CMS
 */
function validateAdminRoles(user: any, authUser: any): void {
  if (user.roles.includes('admin') && authUser.role !== BETTER_AUTH_ROLES.ADMIN) {
    logger.error(RimeError.UNAUTHORIZED);
    throw error(401, RimeError.UNAUTHORIZED);
  }
}

/** The slice of better-auth this file needs for api keys — see handleApiKeyAuth. */
type ApiKeyVerifier = {
  api: {
    verifyApiKey(args: { body: { key: string } }): Promise<{
      valid: boolean;
      key?: { permissions?: { roles: string[] } | null } | null;
    }>;
  };
};

/**
 * Handles API key authentication and role forwarding
 */
async function handleApiKeyAuth(
  headers: Headers,
  user: any,
  // As above: the one call this makes, rather than the whole instance.
  auth: ApiKeyVerifier
): Promise<void> {
  const apiKey = headers.get('x-api-key');
  if (!apiKey) return;

  const result = await auth.api.verifyApiKey({
    body: { key: apiKey }
  });

  if (!result.valid || !result.key || !result.key.permissions) {
    logger.error(RimeError.UNAUTHORIZED, 'Invalid api key');
    throw error(401, RimeError.UNAUTHORIZED);
  }

  user.roles = result.key.permissions.roles;
}

/**
 * Builds complete user data by combining auth and CMS information
 */
async function buildUserData<C extends Config>(
  authResult: AuthResult,
  rime: RimeContext<C>,
  headers: Headers
): Promise<UserData> {
  const { session, user: authUser } = authResult;

  // Get CMS user attributes
  const user = await getCmsUserAttributes(authUser.id, authUser.type, rime);

  // Validate admin roles consistency
  validateAdminRoles(user, authUser);

  // Handle API key authentication.
  //
  // The narrowing is local and deliberate: `C` is still an unbound type parameter here, so
  // better-auth's `api` — which is built from the plugin list a config declares — has nothing
  // concrete to offer yet. The api-key plugin is always in the base config, so the call is sound;
  // it just cannot be proven from inside a function generic over every config.
  await handleApiKeyAuth(headers, user, rime.auth as unknown as ApiKeyVerifier);

  return { user, session, authUser };
}

/**
 * Applies authorization rules based on route and user data
 */
function authorizePanelUser<C extends Config>(
  userData: UserData,
  routeInfo: RouteInfo,
  config: ConfigContext<C>
): void {
  const { user } = userData;

  // Panel-specific authorization
  if (routeInfo.isPanel) {
    // Do not allow non-staff user on panel
    if (!user.isStaff) {
      logger.error(RimeError.UNAUTHORIZED);
      throw error(401, RimeError.UNAUTHORIZED);
    }
    // Defaulted here rather than in the config chain. `augmentPanelAccess` existed to make this
    // one call safe: a server-only step, refining the config's type, for a member nothing else
    // reads. One `??` at the only read site costs less than a step in the chain.
    const panelAccess = config.raw.panel.$access ?? ((u?: User) => access.isAdmin(u));
    if (!panelAccess(user)) {
      logger.error(RimeError.UNAUTHORIZED);
      throw error(401, RimeError.UNAUTHORIZED);
    }
  }
}

/**
 * Sets up event locals and resolves the request. event.locals.user is always the full
 * object, on every route type — server-only code (hooks, access checks) can rely on
 * isStaff/isSuperAdmin regardless of which route triggered it. Only the handful of
 * load() functions that hand `user` to the client need to call toPublicUser() first
 * (see dev/codegen/routes/common.server.ts's public layout templates).
 */
function setupLocalsAndResolve(event: any, resolve: any, userData: UserData): any {
  const { user, session, authUser } = userData;

  event.locals.user = user;
  event.locals.session = session || undefined;
  event.locals.betterAuthUser = authUser;

  return resolve(event);
}

/**
 * Main authentication handler with clear, linear flow
 */
export const handleAuth: Handle = async ({ event, resolve }) => {
  const rime = event.locals.rime;
  const routeInfo = analyzeRoute(event);

  // Ensure auth is set up
  if (routeInfo.isPanel) {
    await ensureFirstAuthSetup(rime);
  }

  // Authenticate the request
  const authResult = await authenticateRequest(event.request.headers, rime.auth);

  // Handle unauthenticated users
  if (!authResult) {
    return handleUnauthenticated(event, resolve, routeInfo);
  }

  // Build complete user data
  const userData = await buildUserData(authResult, rime, event.request.headers);

  // Apply panel authorization rules
  authorizePanelUser(userData, routeInfo, rime.config);

  // Set up locals and resolve
  return setupLocalsAndResolve(event, resolve, userData);
};
