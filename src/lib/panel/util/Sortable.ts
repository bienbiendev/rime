import Sortable from 'sortablejs';
import type SortableType from 'sortablejs';

export const useSortable = ({ ...sortableProps }: SortableType.Options) => {
  const sortable = (el: HTMLElement) => {
    let childNodes: HTMLElement[] = [];
    let from: HTMLElement | null = null;
    const existing = Sortable.get(el);
    if (existing) {
      // Better safe than sorry. At least we know this ain't the case.
      throw new Error('Instance exist. Should never happen.');
    }

    const sortableInstance = new Sortable(el, {
      ...sortableProps,
      onStart: function (e) {
        const node = e.item as Node;
        // Remember the list, and its child nodes, when drag started.
        from = e.from;
        childNodes = Array.prototype.slice.call(node.parentNode!.childNodes);
        // Filter out the 'sortable-fallback' element used on mobile/old browsers.
        childNodes = childNodes.filter(
          (node) =>
            node.nodeType != Node.ELEMENT_NODE || !node.classList.contains('sortable-fallback')
        );
        if (sortableProps.onStart) {
          sortableProps.onStart(e);
        }
      },
      onEnd: function (e) {
        // Put the DOM back the way it was, in the list the drag started from — the item may have
        // landed in another one — so the state change below is the only thing that reorders.
        const parentNode = from ?? (e.item.parentNode as HTMLElement);
        for (const childNode of childNodes) {
          parentNode.appendChild(childNode);
        }
        if (e.from === e.to && e.oldIndex == e.newIndex) return;

        if (sortableProps.onEnd) {
          sortableProps.onEnd(e);
        }
      }
    });
    return sortableInstance;
    // });
  };

  return { sortable };
};
