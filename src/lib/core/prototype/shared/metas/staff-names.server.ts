import { STAFF_SLUG } from '$lib/core/auth/tables.js';
import type { Dic } from '$lib/util/types.js';
import { trycatch } from '$lib/util/function.js';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * The names behind a set of staff ids, for the panel to draw.
 *
 * **Why this is a server-side lookup and not a fetch from the component.** `staff.access.read` is
 * `isAdmin`, so anybody below that gets a 403 asking who edited a document — and an editor is
 * exactly who the lock and the authorship columns are for. Resolving here, through `system()`,
 * says the right thing: showing *who* inside the admin panel is not the same permission as
 * reading the staff collection over the API.
 *
 * One query for the whole page rather than one per row, and `select` keeps it to the two columns
 * that get drawn.
 *
 * Failure is not fatal — an id that resolves to nothing renders as a dash, which is what the panel
 * shows for an absent value anyway.
 */
const resolveStaffNames = async (
  event: RequestEvent,
  ids: (string | null | undefined)[]
): Promise<Dic<string>> => {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (!wanted.length) return {};

  const query = wanted.map((id) => `where[id][in_array][]=${encodeURIComponent(id)}`).join('&');

  const staff = event.locals.rime.collection(STAFF_SLUG as any);

  // `asTitle` alongside `title`, because `title` is derived from it: `setDocumentTitle` reads the
  // field `asTitle` resolved to, so selecting `title` alone narrows that column out of the read
  // and every name comes back as the staff member's own id. The REST layer makes the same
  // correction in `selectWithTitle`; a local-API caller has to make it for itself.
  const [error, docs] = await trycatch(() =>
    staff.system().find({
      query,
      select: ['title', staff.config.asTitle],
      limit: wanted.length
    })
  );

  if (error || !Array.isArray(docs)) return {};

  return Object.fromEntries(docs.map((doc: Dic) => [doc.id, doc.title])) as Dic<string>;
};

/** The three meta fields that hold a staff id. */
const ID_FIELDS = ['createdBy', 'updatedBy', 'currentlyEditedBy'] as const;

/**
 * The same document(s), each carrying the names behind its meta ids.
 *
 * Underscore-prefixed and transient, the way `_thumbnail` and `_live` are: the panel draws them,
 * nothing stores them, and they ride along on the document the load already returns rather than
 * needing a second channel down to the components.
 */
export const withStaffNames = async <T extends Dic | Dic[]>(
  event: RequestEvent,
  input: T
): Promise<T> => {
  const docs = Array.isArray(input) ? input : [input];
  const names = await resolveStaffNames(
    event,
    docs.flatMap((doc) => ID_FIELDS.map((field) => doc[field]))
  );

  const withNames = docs.map((doc) => {
    const resolved: Dic = {};
    for (const field of ID_FIELDS) {
      if (doc[field]) resolved[`_${field}Name`] = names[doc[field]];
    }
    return { ...doc, ...resolved };
  });

  return (Array.isArray(input) ? withNames : withNames[0]) as T;
};
