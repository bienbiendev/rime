import type { FieldHookShared, RelationValue } from '$lib/fields/types.js';

/** Client-side no-op — resolved via `$rime/runtime` when bundling for the browser (see
 *  relation/index.ts). The panel never needs to validate a relation actually exists;
 *  the real check (relation/runtime.server.ts) runs server-side before any write lands. */
export const ensureRelationExists: FieldHookShared = async (value: RelationValue<any>) => value;
