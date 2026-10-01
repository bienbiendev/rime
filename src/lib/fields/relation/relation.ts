import type { RelationRef, RelationValue } from '$lib/fields/types.js';
import { isObjectLiteral } from '$lib/util/object.js';
import { fetchDoc } from './fetch.js';

type Resolution<T> = {
  /** The first document, or `null`. A promise when it has to be fetched. */
  first(): T | null | Promise<T | null>;
  /** Every document. A promise when some have to be fetched. */
  all(): T[] | Promise<T[]>;
};

/** `{ relationTo, documentId }`, whatever else it carries: a ref, not a document. */
const isRef = (value: unknown): value is RelationRef =>
  isObjectLiteral(value) &&
  typeof value.relationTo === 'string' &&
  typeof value.documentId === 'string';

/** Any other object with an `id`: a document, as a read at depth 1 or more hands it back. */
const isDocument = (value: unknown) =>
  isObjectLiteral(value) && !isRef(value) && typeof value.id === 'string';

/** What a live-edit form puts on a ref: the document as it is being edited. */
const livePreviewOf = (ref: RelationRef) => (ref as { livePreview?: unknown }).livePreview;

/**
 * The documents a relation value holds. A document is kept as it is, a ref carrying a live preview
 * gives that preview, and any other ref is fetched from the API. Anything else, a bare id
 * included, names no document and gives nothing.
 *
 * `first()` and `all()` answer the documents themselves when nothing has to be fetched, and a
 * promise otherwise; `await` and `{#await}` take either. A ref that cannot be fetched is left out.
 * During server rendering a ref is not fetched: its promise stays pending, and the browser fetches
 * it once the page hydrates.
 *
 * ```svelte
 * {#await Relation.resolve(block.image).first() then image}
 *   {#if image}<img src={image.sizes.md} alt={image.alt} />{/if}
 * {/await}
 * ```
 */
function resolve<T>(
  value: RelationValue<T> | T | RelationRef | null | undefined | false
): Resolution<T> {
  const entries = (Array.isArray(value) ? value : [value]).filter(
    (entry) => isRef(entry) || isDocument(entry)
  ) as (T | RelationRef)[];

  const toFetch = (entry: T | RelationRef): entry is RelationRef =>
    isRef(entry) && !livePreviewOf(entry);

  const all = (): T[] | Promise<T[]> => {
    const read = (entry: T | RelationRef) => (isRef(entry) ? (livePreviewOf(entry) as T) : entry);
    if (!entries.some(toFetch)) return entries.map(read);
    if (typeof window === 'undefined') return new Promise<T[]>(() => {});
    return Promise.all(
      entries.map((entry) =>
        toFetch(entry)
          ? (fetchDoc(entry.relationTo, entry.documentId) as Promise<T | null>)
          : read(entry)
      )
    ).then((docs) => docs.filter((doc): doc is Awaited<T> => !!doc) as T[]);
  };

  const first = (): T | null | Promise<T | null> => {
    const docs = all();
    return docs instanceof Promise ? docs.then((list) => list[0] ?? null) : (docs[0] ?? null);
  };

  return { first, all };
}

/**
 * Reads relation field values.
 *
 * ```ts
 * await Relation.resolve(page.author).first(); // UsersDoc | null
 * await Relation.resolve(block.images).all(); // MediasDoc[]
 * Relation.isRef(entry); // true for { relationTo, documentId }, false for a document
 * ```
 */
export const Relation = { resolve, isRef };
