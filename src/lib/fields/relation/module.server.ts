import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import { PARAMS } from '$lib/core/constants.js';
import type { FieldHookShared, RelationValue } from '$lib/fields/types.js';
import { trycatchFetch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';

/** Real implementation — resolved server-side via `$rime/fields/relation` (see relation/index.ts,
 *  relation/module.ts for the client-side no-op counterpart). Uses a plain static import of
 *  `$app/server`, which SvelteKit's build blocks from ever reaching client code. */
export const ensureRelationExists: FieldHookShared = async (
  value: RelationValue<any>,
  { config }
) => {
  const output = [];

  const retrieveRelation = async (id: string) => {
    // Forward auth, not the incoming body's headers: Bun's fetch keeps a `content-length` on a
    // bodiless GET (Node's drops it), and the server then waits for a body that never comes.
    const headers = new Headers(getRequestEvent().request.headers);
    for (const name of ['content-length', 'content-type', 'transfer-encoding']) {
      headers.delete(name);
    }
    const [err, response] = await trycatchFetch(
      `${env.PUBLIC_RIME_URL}/api/${toKebabCase(config.relationTo)}/${id}?${PARAMS.SELECT}=id`,
      {
        method: 'GET',
        headers
      }
    );
    if (err) return null;
    const { doc } = await response.json();
    return doc;
  };

  if (value && Array.isArray(value)) {
    for (const relation of value) {
      // A `null` element — what `[undefined]` becomes over JSON — names nothing, like an unknown id.
      const documentId = typeof relation === 'string' ? relation : relation?.documentId;
      if (!documentId) {
        continue;
      }
      const doc = await retrieveRelation(documentId);
      if (doc) {
        output.push(relation);
      }
    }
  } else if (typeof value === 'string') {
    const doc = await retrieveRelation(value);
    if (doc) {
      output.push(doc.id);
    }
  }

  return output;
};
