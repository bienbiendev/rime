export const PARAMS = {
  /**
   * The panel typing over a document: the update lands on the caller's own auto-saved row of the
   * version `versionId` names, on a config with `versions: { draft: true, autoSave: true }`.
   * Read by the panel form actions only; the REST API ignores it.
   *
   * @example ?/update&autoSave=true&versionId=abc
   */
  AUTO_SAVE: 'autoSave',

  /** Fetch nested documents in relation / link at a specific depth */
  DEPTH: 'depth',

  /**
   * Make a new version. The update starts from the row the other parameters select — the
   * published one, the newest with `latest`, a named one with `versionId` — copies it into a new
   * row, a draft unless the body says otherwise, and writes the body onto that row. Without it an
   * update writes the selected row in place.
   *
   * A config with versions and no drafts keeps a version per save: there, an update that names
   * no `versionId` is a fork whether it says so or not. Every case is tabled on
   * `defineVersionUpdateOperation` in `core/prototype/shared/versions/strategy.ts`.
   *
   * @example PATCH /api/pages/<id>?fork=true
   */
  FORK: 'fork',

  /**
   * The newest version, whatever its status, where the published one is meant otherwise. The
   * same on a read and on a write: `GET ?latest=true` returns it, `PATCH ?latest=true` writes
   * it. `versionId` names a row and makes this moot. Only a config with drafts has a published
   * row to prefer, and only staff may ask; anyone else gets the published version.
   *
   * @example GET /api/pages/<id>?latest=true
   */
  LATEST: 'latest',

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

  /**
   * On fetch operation, the fields to fetch.
   * @example ?select=title,updatedAt
   */
  SELECT: 'select',

  /** On fetch list operation order documents
   * @example ?sort=-title
   */
  SORT: 'sort',

  /** GET / UPDATE a specific version*/
  VERSION_ID: 'versionId',

  /**
   * The upload folder the panel list opens at; the create form sends it on as `_path`.
   * @example ?uploadPath=root:images
   */
  UPLOAD_PATH: 'uploadPath',

  /**
   * A staff create or update that leaves required fields empty: the panel's bulk upload sends a
   * file before its other fields. Every other check still runs.
   * @example ?skipValidation=true
   */
  SKIP_VALIDATION: 'skipValidation'
} as const;

/** The deepest relation level any read resolves, REST or local API: `depth: 50` reads at 3. */
export const MAX_DEPTH = 3;
