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

  /** Parameter for panel collection list to filter out documents from a specific uploadPath */
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
