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
   * Which version row a request means, on a config with `versions: { draft: true }`. Ignored
   * everywhere else: a config without drafts has no published/draft distinction to pick from.
   *
   * On a **read** (`GET /api/<slug>`, `GET /api/<slug>/<id>`, an area's `GET`):
   *
   * ```
   * absent or false   the published row — a document with none is a 404 by id, and is dropped
   *                   from a list
   * true              the newest row by `updatedAt`, whatever its status
   * with versionId    that row, whatever its status; `draft` is not read
   * ```
   *
   * On an **update** (`PATCH`) without a `versionId` it says which row to write *from*, and the
   * meaning flips:
   *
   * ```
   * true              branch a new draft version from the **published** row (404 when there is
   *                   none — see notes/known-defects.md §1)
   * absent or false   write the published row in place
   * with versionId    write that row in place; `draft` is not read
   * ```
   *
   * Never read on a create, a delete or a duplicate. Gated by the config's `access.read` alone,
   * so a public collection answers `?draft=true` to anyone. The decision tables are
   * `core/prototype/shared/versions/read-query.ts` and `strategy.ts`.
   *
   * @example ?draft=true
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
