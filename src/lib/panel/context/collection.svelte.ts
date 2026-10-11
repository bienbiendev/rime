import type { UploadPath } from '#lib/core/prototype/collection/upload/util/path.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { invalidateAll } from '$app/navigation';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { PARAMS } from '#lib/core/constants.js';
import type { FieldBuilder } from '#lib/core/fields/builders/index.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import type { Directory } from '#lib/core/prototype/collection/upload/types.js';
import { isUploadConfig } from '#lib/core/prototype/collection/upload/util/config.js';
import { toNestedStructure } from '#lib/core/prototype/collection/nested/tree.js';
import type { GenericDoc, GenericNestedDoc } from '#lib/core/prototype/types.js';
import { apiUrl } from '#lib/core/routes/util.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import type { FormField } from '#lib/fields/types.js';
import type { FieldPanelTableConfig } from '#lib/panel/types.js';
import { deletedToast } from '#lib/panel/context/bulk-delete.js';
import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
import {
  fileSizeBytes,
  mediaKind,
  MEDIA_KINDS,
  type MediaKind
} from '#lib/panel/util/upload-file.js';
import { titleText } from '#lib/panel/util/title.js';
import { withLocale } from '#lib/panel/util/url.js';
import { trycatchFetch } from '#lib/util/function.js';
import { getValueAtPath, hasProp } from '#lib/util/object.js';
import type { WithRequired } from '#lib/util/types.js';
import { computeCommandScore } from 'bits-ui';
import { getContext, onMount, setContext, untrack, type Component } from 'svelte';
import { toast } from 'svelte-sonner';

type TableColumn = {
  type: string;
  name: string;
  label: string;
  path: string;
  cell: null | Component<{ value: any }>;
  table: FieldPanelTableConfig;
};

type SortMode = 'asc' | 'dsc';
type DisplayMode = (typeof DISPLAY_MODE)[keyof typeof DISPLAY_MODE];
export type StatusFilter = 'all' | typeof VERSIONS_STATUS.DRAFT | typeof VERSIONS_STATUS.PUBLISHED;
export type KindFilter = 'all' | MediaKind;

export const DISPLAY_MODE = {
  LIST: 'display_list',
  GRID: 'display_grid',
  NESTED: 'display_nested'
} as const;

function createCollectionStore<T extends GenericDoc = GenericDoc>(args: Args<T>) {
  const { initial, config, canCreate, upload: incomingUpload } = args;
  const locale = getLocaleContext();

  // The latest edit first, until another order is picked.
  let sortingOrder = $state<SortMode>('dsc');
  let sortingBy = $state<string>('updatedAt');
  let initialDocs = $state.raw(initial);
  let docs = $state(sorted([...initial]));
  let selected = $state<string[]>([]);
  let statusFilter = $state<StatusFilter>('all');
  let kindFilter = $state<KindFilter>('all');
  let displayMode = $state<DisplayMode>(DISPLAY_MODE.LIST);
  let upload = $state({
    directories: incomingUpload?.directories || [],
    currentPath: incomingUpload?.currentPath || UPLOAD_PATH.ROOT_NAME,
    parentDirectory: incomingUpload?.parentDirectory || null
  });
  let isFiltered = $state(false);
  /** The search as typed. */
  let query = '';
  // A new stamp remounts the tree (CollectionTree.svelte:97).
  let stamp = $state(Date.now());
  const hasDraft = $derived(config.versions && config.versions.draft);

  onMount(() => {
    const storedDisplay = localStorage.getItem(`collection.${config.slug}.display`) as DisplayMode;
    displayMode =
      storedDisplay && (storedDisplay !== DISPLAY_MODE.NESTED || config.nested)
        ? storedDisplay
        : DISPLAY_MODE.LIST;
    const localSortBy = localStorage.getItem(`collection.${config.slug}.sortBy`);
    sortingBy = localSortBy || 'updatedAt';
    const localSortOrder = localStorage.getItem(`collection.${config.slug}.sortOrder`) as SortMode;
    sortingOrder = localSortOrder || 'dsc';
    if (localSortBy) {
      sortBy(sortingBy, false);
    }
  });

  const nested = $derived.by(() => {
    return toNestedStructure(docs);
  });

  /** An upload collection shows the files of the folder on screen; any other, all of them. */
  const inFolder = (doc: GenericDoc) => !config.upload || doc._path === upload.currentPath;
  const ofStatus = (doc: GenericDoc) => statusFilter === 'all' || doc.status === statusFilter;
  const ofKind = (doc: GenericDoc) =>
    kindFilter === 'all' || mediaKind(doc.mimeType) === kindFilter;

  /** The documents on screen: the search's, in the folder, of the status and the kind picked. */
  const shown = $derived(docs.filter((doc) => inFolder(doc) && ofStatus(doc) && ofKind(doc)));

  /** The kinds of file the collection holds, in a fixed order. */
  const kinds = $derived.by(() => {
    const present = new Set(initialDocs.map((doc) => mediaKind(doc.mimeType)));
    return MEDIA_KINDS.filter((kind) => present.has(kind));
  });

  const draftsCount = $derived(
    hasDraft ? initialDocs.filter((doc) => doc.status === VERSIONS_STATUS.DRAFT).length : 0
  );

  /** What the files weigh together, in bytes. */
  const totalSize = $derived(
    initialDocs.reduce((sum, doc) => sum + (fileSizeBytes(doc.filesize) ?? 0), 0)
  );

  /** Where a slug field sits, when the collection has one. */
  const slugPath = [...walkFields(config.fields, { determinate: true })].find(
    ({ field }) => field.type === 'slug'
  )?.path;

  /**
   * The path a list row shows after the document's title: the pathname of its url, else its slug.
   *
   * ```ts
   * pathOf({ url: 'https://site.com/studio' }) // '/studio'
   * pathOf({ attributes: { slug: 'studio' } }) // 'studio'
   * ```
   */
  function pathOf(doc: GenericDoc) {
    if (!config.upload && typeof doc.url === 'string' && doc.url) {
      try {
        return new URL(doc.url, 'http://localhost').pathname;
      } catch {
        return doc.url;
      }
    }
    const slug = slugPath ? getValueAtPath(slugPath, doc) : null;
    return typeof slug === 'string' ? slug : '';
  }

  /** Every field marked `table()`, at a path a config alone can name. */
  const buildFieldColumns = (fields: FieldBuilder[]) => {
    const columns: TableColumn[] = [];
    for (const { field, path } of walkFields(fields, { determinate: true })) {
      if (isFormField(field) && hasProp('table', field.get)) {
        columns.push({
          type: field.type,
          name: field.name,
          label: field.get.label,
          path,
          cell: field.get.table.cell || field.cell,
          table: field.get.table
        });
      }
    }
    return columns;
  };

  // The builder stores every column's position: `.table(0)` comes first
  const columns = buildFieldColumns(config.fields).sort(
    (a, b) => a.table.position - b.table.position
  );

  /** The documents in the order picked, by `sortingBy` then `sortingOrder`. */
  function sorted(list: T[]) {
    const orderMult = sortingOrder === 'asc' ? 1 : -1;
    // A column inside a group sorts by its path: `seo.score`
    return list.sort((a, b) => {
      const left = getValueAtPath<any>(sortingBy, a);
      const right = getValueAtPath<any>(sortingBy, b);
      if (left < right) {
        return -1 * orderMult;
      }
      if (left > right) {
        return 1 * orderMult;
      }
      return 0;
    });
  }

  const sortBy = (fieldName: string, toggle: boolean = true) => {
    if (sortingBy === fieldName) {
      if (toggle) {
        sortingOrder = sortingOrder === 'asc' ? 'dsc' : 'asc';
      }
    } else {
      // Another field: sort by it, in the current order.
      sortingBy = fieldName;
    }
    docs = sorted(docs);
    // Save to local storage
    localStorage.setItem(`collection.${config.slug}.sortBy`, fieldName);
    localStorage.setItem(`collection.${config.slug}.sortOrder`, sortingOrder);
  };

  const deleteDocs = async (ids: string[]) => {
    const toDelete = [...docs].filter((doc) => ids.includes(doc.id));
    docs = docs.filter((doc) => !ids.includes(doc.id));
    initialDocs = docs;

    const deleteUrl = `${apiUrl(config.kebab)}?where[id][in_array]=${toDelete.map((d) => d.id).join(',')}`;
    const [error, response] = await trycatchFetch(deleteUrl, {
      method: 'DELETE'
    });

    if (error) {
      console.error(error);
      toast.error('An error occured while deleting documents');
    } else {
      // The answer lists what went: a row the caller may not delete stays
      const { docs: deleted = [] } = await response.json();
      const told = deletedToast(toDelete.length, deleted.length);
      toast[told.kind](told.message);
    }
    await invalidateAll();
  };

  /**
   * Moves `documentId` under `to.parent` at `to.index`, renumbers its new siblings, and saves the
   * changed documents.
   */
  const handleNestedDocumentMove = async ({
    from,
    to,
    documentId
  }: {
    documentId: string;
    from: { parent: string | null; index: number };
    to: { parent: string | null; index: number };
  }) => {
    const updatedDocs = [...docs] as GenericNestedDoc[];
    const docToMove = updatedDocs.find((d) => d.id === documentId);
    if (!docToMove) return;

    const docsToUpdate = new Map<string, GenericDoc>();

    if (from.parent !== null) {
      const oldParent = updatedDocs.find((d) => d.id === from.parent);
      if (oldParent) {
        const oldChildren = [...(oldParent._children || [])];
        const childIndex = oldChildren.indexOf(documentId);
        if (childIndex > -1) {
          oldChildren.splice(childIndex, 1);
          oldParent._children = oldChildren;
          docsToUpdate.set(oldParent.id, oldParent);
        }
      }
    }

    if (to.parent !== null) {
      const newParent = updatedDocs.find((d) => d.id === to.parent);
      if (newParent) {
        const newChildren = [...(newParent._children || [])];
        newChildren.splice(to.index, 0, documentId);
        newParent._children = newChildren;
        docsToUpdate.set(newParent.id, newParent);
      }
    }

    docToMove._parent = to.parent;
    docToMove._position = to.index;
    docsToUpdate.set(docToMove.id, docToMove);

    const siblings = updatedDocs
      .filter((doc) => doc._parent === to.parent && doc.id !== documentId)
      .sort((a, b) => (a._position || 0) - (b._position || 0));

    let position = 0;
    for (const sibling of siblings) {
      if (position === to.index) position++;
      if (sibling._position !== position) {
        sibling._position = position;
        docsToUpdate.set(sibling.id, sibling);
      }
      position++;
    }

    docs = updatedDocs as T[];
    stamp = Date.now();

    try {
      await apiUpdateNestedStructure(Array.from(docsToUpdate.values()));
      return true;
    } catch (error) {
      console.error('Failed to update documents:', error);
      // Revert to the stored docs, read as the page loads them: drafts included
      docs = await fetch(withLocale(`${apiUrl(config.kebab)}?${PARAMS.LATEST}=true`, locale.code))
        .then((r) => r.json())
        .then((r) => r.docs);
      stamp = Date.now();
      return false;
    }
  };

  /** PATCHes each document's `_parent` and `_position`; throws when one fails. */
  const apiUpdateNestedStructure = async (docsToUpdate: GenericDoc[]) => {
    const responses = await Promise.all(
      docsToUpdate.map((doc) => {
        let url = apiUrl(config.kebab, doc.id);
        if (doc.versionId) {
          url += `?${PARAMS.VERSION_ID}=${doc.versionId}`;
        }
        return fetch(url, {
          method: 'PATCH',
          body: JSON.stringify({
            _parent: doc._parent,
            _position: doc._position
          }),
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    // A refused PATCH (403, 500) throws too
    const refused = responses.find((response) => !response.ok);
    if (refused) throw new Error(`${refused.url} answered ${refused.status}`);
    return true;
  };

  function isGrid() {
    return displayMode === DISPLAY_MODE.GRID;
  }
  function isNested() {
    return displayMode === DISPLAY_MODE.NESTED && !!config.nested;
  }

  function toggleSelectOf(docId: string) {
    if (selected.includes(docId)) {
      selected = selected.filter((id) => id !== docId);
    } else {
      selected.push(docId);
    }
  }

  function selectAll() {
    selected = shown.map((doc) => doc.id);
  }

  async function deleteSelection() {
    const ids = selected;
    selected = [];
    await deleteDocs(ids);
  }

  /** The text the search matches: the title field's, as text. */
  const searchText = (doc: GenericDoc) => titleText(getValueAtPath(config.asTitle, doc));

  function filterBy(inputValue: string) {
    query = inputValue;
    if (inputValue === '') {
      isFiltered = false;
      docs = sorted([...initialDocs]);
      return;
    }
    isFiltered = true;
    const scored = initialDocs
      .map((doc) => ({ doc, text: searchText(doc) }))
      .filter(({ text }) => text)
      .map((entry) => ({ ...entry, score: computeCommandScore(entry.text, inputValue) }))
      .filter(({ score }) => score > 0);
    // The best match first, then by title
    scored.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
    docs = scored.map(({ doc }) => doc);
  }

  return {
    get stamp() {
      return stamp;
    },

    get title() {
      return config.label.plural;
    },

    get hasDraft() {
      return hasDraft;
    },

    get apiUrl() {
      return apiUrl(config.kebab);
    },

    config,
    canCreate,
    isGrid,
    isNested,

    set display(mode: DisplayMode) {
      localStorage.setItem(`collection.${config.slug}.display`, mode);
      displayMode = mode;
    },

    get display() {
      return displayMode;
    },

    columns: columns as Array<{ path: string } & WithRequired<FormField, 'table'>>,
    sortBy,

    get sortingOrder() {
      return sortingOrder;
    },

    get sortingBy() {
      return sortingBy;
    },

    get isFiltered() {
      return isFiltered;
    },

    toggleSelectOf,
    selectAll,

    get selected() {
      return selected;
    },
    set selected(value) {
      selected = value;
    },
    /** On while a document is checked. */
    get selectMode() {
      return selected.length > 0;
    },
    get isAllSelected() {
      return shown.length > 0 && shown.every((doc) => selected.includes(doc.id));
    },

    deleteSelection,
    filterBy,

    /** The documents on screen, after the search, the folder and the filters. */
    get shown() {
      return shown;
    },

    /** A filter change drops the selection, so no hidden document stays picked. */
    get statusFilter() {
      return statusFilter;
    },
    set statusFilter(value: StatusFilter) {
      statusFilter = value;
      selected = [];
    },

    get kindFilter() {
      return kindFilter;
    },
    set kindFilter(value: KindFilter) {
      kindFilter = value;
      selected = [];
    },

    get kinds() {
      return kinds;
    },

    get draftsCount() {
      return draftsCount;
    },

    get totalSize() {
      return totalSize;
    },

    /** Every document of the collection, whatever the search. */
    get total() {
      return initialDocs.length;
    },

    pathOf,

    get isUpload() {
      return isUploadConfig(config);
    },

    get upload() {
      if (isUploadConfig(config)) {
        return upload;
      }
      throw new Error('upload is available only on upload collections');
    },

    set upload(value) {
      upload = value;
    },

    get docs() {
      return docs;
    },
    /** A reload: the search runs again over the new documents, in the order picked. */
    set docs(value) {
      initialDocs = value;
      untrack(() => filterBy(query));
      stamp = Date.now();
    },

    get nested() {
      return nested;
    },
    handleNestedDocumentMove
  };
}

export const COLLECTION_CTX = Symbol('rime.collection');

export function setCollectionContext(args: Args) {
  const store = createCollectionStore(args);
  return setContext(COLLECTION_CTX, store);
}

export function getCollectionContext() {
  return getContext<CollectionContext>(COLLECTION_CTX);
}

export type CollectionContext = ReturnType<typeof setCollectionContext>;

type Args<T extends GenericDoc = GenericDoc> = {
  initial: T[];
  config: BuiltCollection;
  canCreate: boolean;
  upload?: {
    directories?: Directory[];
    currentPath?: UploadPath;
    parentDirectory?: Directory;
  };
};
