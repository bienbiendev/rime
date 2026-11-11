import { t__ } from '#lib/core/i18n/index.js';
import type { CollectionContext } from '#lib/panel/context/collection.svelte.js';
import Sortable from 'sortablejs';
import type { Attachment } from 'svelte/attachments';
import { toast } from 'svelte-sonner';

/**
 * Makes one list of the collection tree sortable for as long as it is mounted. A row moves by its
 * grip, into this list or another list of the tree, and the move is saved.
 *
 * ```svelte
 * <div class="rz-collection-sortable" data-id="root" {@attach sortableList(collection)}>
 * ```
 */
export const sortableList =
  (collection: CollectionContext): Attachment<HTMLElement> =>
  (element) => {
    const sortable = Sortable.create(element, {
      handle: '.rz-collection-node__grip',
      animation: 150,
      swapThreshold: 0.93,
      // A childless node's list has no height: a drop this close to it nests under that node.
      emptyInsertThreshold: 8,
      group: { name: 'list-nested' },
      onEnd: (evt) => moveNode(collection, evt)
    });
    return () => sortable.destroy();
  };

/**
 * Saves a dropped row with the list it lands in, in the order on screen. The list's `data-id`
 * names the new parent, `root` none.
 */
async function moveNode(collection: CollectionContext, evt: Sortable.SortableEvent) {
  // Released where it was taken: nothing to save.
  if (evt.from === evt.to && evt.oldIndex === evt.newIndex) return;

  const listId = evt.to.getAttribute('data-id');
  const rows = evt.to.querySelectorAll(':scope > .rz-collection-node');
  const success = await collection.handleNestedDocumentMove({
    documentId: evt.item.getAttribute('data-id') as string,
    parent: listId === 'root' ? null : listId,
    order: [...rows].map((row) => row.getAttribute('data-id') as string)
  });
  if (success) {
    toast.success(t__('common.order_updated'));
  } else {
    toast.error(t__('common.generic_error'));
  }
}
