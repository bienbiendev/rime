/** What one document's read names, on any prototype. A collection adds the document's `id`. */
export type ReadArgs = {
  locale?: string | undefined;
  depth?: number;
  select?: string[];
  versionId?: string;
  /** The newest version, whatever its status; the published one otherwise. `PARAMS.LATEST`. */
  latest?: boolean;
  /**
   * Whether a field the locale has not written reads from the other locales. `true` unless said
   * otherwise; `false` is the locale's own rows, which is what a copy onto another row reads.
   */
  localeFallback?: boolean;
};
