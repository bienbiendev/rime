/**
 * The `select` a request asked for, with the field behind `title` added when it asked for `title`.
 *
 * `title` is not a column. `setDocumentTitle` — `shared/title/hooks/set-document-title.server.ts`
 * — reads it out of whatever `asTitle` resolved to, on a document the adapter has already
 * narrowed. So a select naming `title` without naming that field narrows the read to columns the
 * hook cannot see, `getValueAtPath(config.asTitle, doc)` comes back undefined, and the document is
 * titled with its own id.
 *
 * Every REST endpoint that parses this param goes through here, so `?select=title` means the same
 * thing on `/pages` and on `/pages/<id>`.
 *
 * @param raw The `select` search param as sent — comma separated, or null when absent.
 * @param asTitle The config's resolved title path (`BuiltCollection`/`BuiltArea`).
 */
export const selectWithTitle = (raw: string | null, asTitle: string): string[] | undefined => {
  if (!raw) return undefined;

  const select = raw.split(',');

  if (select.includes('title') && !select.includes(asTitle)) {
    select.push(asTitle);
  }

  return select;
};
