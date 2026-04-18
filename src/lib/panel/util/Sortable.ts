import Sortable from 'sortablejs';
import type SortableType from 'sortablejs';

export const useSortable = ({ ...sortableProps }: SortableType.Options) => {
  const sortable = (el: HTMLElement) => {
    let childNodes: HTMLElement[] = [];
    const existing = Sortable.get(el);
    if (existing) {
      // Better safe than sorry. At least we know this ain't the case.
      throw new Error('Instance exist. Should never happen.');
    }

    const sortableInstance = new Sortable(el, {
      ...sortableProps,
      onStart: function (e) {
        const node = e.item as Node;
        // Remember the list of child nodes when drag started.
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
        const node = e.item as Node;
        const parentNode = node.parentNode!;
        for (const childNode of childNodes) {
          parentNode.appendChild(childNode);
        }
        if (e.oldIndex == e.newIndex) return;

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
