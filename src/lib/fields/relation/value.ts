import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { Relation } from './index.js';

/** A related document as the field holds it before it is written: its id, and its row if any. */
export type RelationItem = { documentId: string; id?: string; livePreview?: GenericDoc };

/**
 * The value a relation field writes for these documents, in this order.
 *
 * ```ts
 * toRelationValue([{ documentId: 'a' }, { documentId: 'b', id: 'r1' }], { relationTo: 'medias', path: 'photos' })
 * // [{ relationTo: 'medias', path: 'photos', position: 0, documentId: 'a' },
 * //  { id: 'r1', relationTo: 'medias', path: 'photos', position: 1, documentId: 'b' }]
 * ```
 *
 * `locale` is set on a localized field; `livePreview` rides along in a live-edit form.
 */
export function toRelationValue(
  items: RelationItem[],
  args: { relationTo: string; path: string; locale?: string; live?: boolean }
): Omit<Relation, 'ownerId'>[] {
  return items.map((item, index) => {
    const relation: Omit<Relation, 'ownerId'> = {
      id: item.id,
      relationTo: args.relationTo,
      path: args.path,
      position: index,
      documentId: item.documentId
    };
    if (args.locale) relation.locale = args.locale;
    if (args.live && item.livePreview) relation.livePreview = item.livePreview;
    return relation;
  });
}
