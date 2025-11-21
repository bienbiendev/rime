import { RimeError } from '$lib/core/errors/index.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import type { Config, User } from '$lib/types.js';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { BETTER_AUTH_ROLES } from '../collections/auth/constant.server.js';
import { logger } from '../logger/index.server.js';
import type { ConfigContext, RimeContext } from '../rime.server.js';

const dev = process.env.NODE_ENV === 'development';

interface RouteInfo {
	isSignIn: boolean;
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
 * Analyzes the current route to determine authentication requirements
 */
function analyzeRoute(pathname: string): RouteInfo {
	const isSignIn = pathname === '/panel/sign-in';
	const isPanel = pathname.startsWith('/panel') && !isSignIn;
	const isAPI = pathname.startsWith('/api');

	return { isSignIn, isPanel, isAPI };
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
	auth: RimeContext['auth']
): Promise<AuthResult | null> {
	return await auth.api.getSession({ headers });
}

/**
 * Handles unauthenticated users based on route requirements
 */
function handleUnauthenticated(event: any, resolve: any, routeInfo: RouteInfo): any {
	if (routeInfo.isPanel) {
		throw redirect(303, '/panel/sign-in');
	}

	event.locals.user = undefined;
	event.locals.session = undefined;
	return resolve(event);
}

/**
 * Gets CMS user attributes for the authenticated user
 */
async function getCmsUserAttributes(
	authUserId: string,
	userType: string,
	rime: RimeContext
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

/**
 * Handles API key authentication and role forwarding
 */
async function handleApiKeyAuth(
	headers: Headers,
	user: any,
	auth: RimeContext['auth']
): Promise<void> {
	const apiKey = headers.get('x-api-key');
	if (!apiKey) return;

	const result = await auth.api.verifyApiKey({
		body: { key: apiKey }
	});

	if (!result.valid || !result.key || typeof result.key.permissions !== 'string') {
		logger.error(RimeError.UNAUTHORIZED, 'Invalid api key');
		throw error(401, RimeError.UNAUTHORIZED);
	}

	const permissions = JSON.parse(result.key.permissions);
	user.roles = permissions.roles;
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

	// Handle API key authentication
	await handleApiKeyAuth(headers, user, rime.auth);

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
		if (!config.raw.panel.$access(user)) {
			logger.error(RimeError.UNAUTHORIZED);
			throw error(401, RimeError.UNAUTHORIZED);
		}
	}
}

/**
 * Sets up event locals and resolves the request
 */
function setupLocalsAndResolve(event: any, resolve: any, userData: UserData): any {
	const { user, session, authUser } = userData;

	event.locals.user = user;
	event.locals.session = session || undefined;
	event.locals.betterAuthUser = authUser;

	return resolve(event);
}

/**
 * Clean up user props
 */
function cleanupUser(userData: UserData, routeInfo: RouteInfo) {
	if (!routeInfo.isPanel && !routeInfo.isAPI) {
		delete userData.user.isSuperAdmin;
		delete userData.user.isStaff;
	}
	return userData;
}

/**
 * Main authentication handler with clear, linear flow
 */
export const handleAuth: Handle = async ({ event, resolve }) => {
	const rime = event.locals.rime;
	const routeInfo = analyzeRoute(event.url.pathname);

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
	let userData = await buildUserData(authResult, rime, event.request.headers);

	// Apply panel authorization rules
	authorizePanelUser(userData, routeInfo, rime.config);

	// Filter user props if not on panel or API
	userData = cleanupUser(userData, routeInfo);

	// Set up locals and resolve
	return setupLocalsAndResolve(event, resolve, userData);
};
