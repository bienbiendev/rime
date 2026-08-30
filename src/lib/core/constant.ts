/** The generated panel route always lives at this fixed matcher-folder id — the literal
 * folder name never changes, only which segment value src/params/panel.ts's matcher
 * accepts (see PANEL_ROUTE in core/dev/constants.ts). Route ids never carry the resolved
 * param value, so these are safe to compare against event.route.id without leaking the
 * configured secret. */
export const PANEL_ROUTE_ID = '/(rime)/[panel=panel]';
export const PANEL_SIGN_IN_ROUTE_ID = `${PANEL_ROUTE_ID}/sign-in`;
export const PANEL_FORGOT_PASSWORD_ROUTE_ID = `${PANEL_ROUTE_ID}/forgot-password`;
export const PANEL_RESET_PASSWORD_ROUTE_ID = `${PANEL_ROUTE_ID}/reset-password`;

/** sign-in, forgot-password and reset-password all have to stay reachable by an
 * unauthenticated visitor (someone locked out, or clicking a reset link from email) even
 * though they now live under the same hidden [panel=panel] segment as the rest of the
 * panel — this is the auth-gate's "public, no-session-required" exception, broadened from
 * sign-in alone to cover all three. */
const PANEL_PUBLIC_AUTH_ROUTE_IDS = new Set([
  PANEL_SIGN_IN_ROUTE_ID,
  PANEL_FORGOT_PASSWORD_ROUTE_ID,
  PANEL_RESET_PASSWORD_ROUTE_ID
]);

export function isPublicPanelAuthRoute(routeId: string | null): boolean {
  return !!routeId && PANEL_PUBLIC_AUTH_ROUTE_IDS.has(routeId);
}

export const VERSIONS_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
} as const;

export const PARAMS = {
  /** Fetch nested documents in relation / link at a specific depth */
  DEPTH: 'depth',

  /**
   * @TODO add documentation here for the draft param
   */
  DRAFT: 'draft',

  /**
   * GET operations limit number of documents
   * @example ?limit=4
   */
  LIMIT: 'limit',

  /** GET / CREATE / UPDATE a specific document locale
   * @example ?locale=en
   */
  LOCALE: 'locale',

  /** GET documents with an offset number
   * @example ?limit=4&offset=4
   */
  OFFSET: 'offset',

  /**
   * Redirect or not after creation operation
   * @example ?redirect=false
   */
  REDIRECT: 'redirect',

  /** On fetch operation fields to be fetched
   * @example ?depth=3
   */
  SELECT: 'select',

  /** On fetch list operation order documents
   * @example ?sort=-title
   */
  SORT: 'sort',

  /** GET / UPDATE a specific version*/
  VERSION_ID: 'versionId',

  /** On fetch (upload) list operation filter out documents from a specific uploadPath */
  UPLOAD_PATH: 'uploadPath',

  /**
   * Disable validation on CREATE / UPDATE operations
   * @example ?skipValidation=true
   */
  SKIP_VALIDATION: 'skipValidation'
} as const;

export const UPLOAD_PATH = {
  SEPARATOR: ':',
  ROOT_NAME: 'root'
} as const;

export type VersionsStatus = (typeof VERSIONS_STATUS)[keyof typeof VERSIONS_STATUS];
