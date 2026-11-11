import type { UploadPath } from '#lib/core/prototype/collection/upload/util/path.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { invalidateAll } from '$app/navigation';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { PARAMS } from '#lib/core/constants.js';
import { t__ } from '#lib/core/i18n/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/index.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import type { Directory } from '#lib/core/prototype/collection/upload/types.js';
import { isUploadConfig } from '#lib/core/prototype/collection/upload/util/config.js';
import { toNestedStructure } from '#lib/core/prototype/collection/nested/tree.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import { apiUrl } from '#lib/core/routes/util.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import type { FormField } from '#lib/fields/types.js';
import type { FieldPanelTableConfig } from '#lib/panel/types.js';
import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
import { deletedToast } from '#lib/panel/context/bulk-delete.js';
import {
  fileSizeBytes,
  mediaKind,
  MEDIA_KINDS,
  type MediaKind
} from '#lib/panel/util/upload-file.js';
import { readStored, writeStored } from '#lib/panel/util/storage.js';
import { titleText } from '#lib/panel/util/title.js';
import { trycatchFetch } from '#lib/util/function.js';
import { getValueAtPath, hasProp } from '#lib/util/object.js';
import type { WithRequired } from '#lib/util/types.js';
import { computeCommandScore } from 'bits-ui';
import { getContext, setContext, untrack, type Component } from 'svelte';
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

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

/** Strings in reading order, case aside; anything else as `<` sees it. */
const compareValues = (left: any, right: any) => {
  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right, undefined, { sensitivity: 'base' });
  }
  return left < right ? -1 : left > right ? 1 : 0;
};

/** The state of one collection's list page: its documents, order, search, filters and selection. */
function createCollectionStore<T extends GenericDoc = GenericDoc>(args: Args<T>) {
  const { initial, config, canCreate, upload: incomingUpload } = args;
  const APIProxy = getAPIProxyContext();

  /** The browser keeps each list's display and sort: `collection.<slug>.display`. */
  const storageKey = (name: 'display' | 'sortBy' | 'sortOrder') =>
    `collection.${config.slug}.${name}`;
  const storedDisplay = readStored(storageKey('display'));

  // The stored order, else the latest edit first.
  let sortingOrder = $state<SortMode>((readStored(storageKey('sortOrder')) as SortMode) || 'dsc');
  let sortingBy = $state<string>(readStored(storageKey('sortBy')) || 'updatedAt');
  let initialDocs = $state.raw(initial);
  let docs = $state(sorted([...initial]));
  let selected = $state<string[]>([]);
  let statusFilter = $state<StatusFilter>('all');
  let kindFilter = $state<KindFilter>('all');
  let displayMode = $state<DisplayMode>(
    storedDisplay && (storedDisplay !== DISPLAY_MODE.NESTED || config.nested)
      ? (storedDisplay as DisplayMode)
      : DISPLAY_MODE.LIST
  );
  let upload = $state({
    directories: incomingUpload?.directories || [],
    currentPath: incomingUpload?.currentPath || UPLOAD_PATH.ROOT_NAME,
    parentDirectory: incomingUpload?.parentDirectory || null
  });
  let isFiltered = $state(false);
  /** The search as typed. */
  let query = '';
  // A new stamp remounts the tree (the {#key} in CollectionTree.svelte).
  let stamp = $state(Date.now());
  const hasDraft = $derived(config.versions && config.versions.draft);

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
      const left = getValueAtPath(sortingBy, a);
      const right = getValueAtPath(sortingBy, b);
      // A document without the value goes last, in either order
      if (isBlank(left) || isBlank(right)) {
        return Number(isBlank(left)) - Number(isBlank(right));
      }
      return compareValues(left, right) * orderMult;
    });
  }

  /**
   * Sorts by `fieldName`. The same field again flips the order, unless `toggle` is false. The
   * browser keeps the choice for the list's next opening.
   */
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
    writeStored(storageKey('sortBy'), fieldName);
    writeStored(storageKey('sortOrder'), sortingOrder);
  };

  /**
   * Deletes the documents with these ids in one request. They leave the list at once, and the
   * page data reloads after.
   */
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
      toast.error(t__('common.generic_error'));
    } else {
      // The answer lists what went: a row the caller may not delete stays
      const { docs: deleted = [] } = await response.json();
      const told = deletedToast(toDelete.length, deleted.length, isUploadConfig(config));
      toast[told.kind](told.message);
    }
    // The API proxy's reads of the collection (a page's children) drop the deleted documents.
    APIProxy.invalidate(apiUrl(config.kebab));
    await invalidateAll();
  };

  /**
   * Saves a move of the tree in one request: `documentId` under `parent`, `null` for the top, and
   * its new list in `order`, the ids as dropped on screen. The tree shows the drop until the page
   * data reloads, whether the server took the move or not. Answers whether it did.
   *
   * ```ts
   * await handleNestedDocumentMove({ documentId: 'c', parent: 'p', order: ['c', 'a', 'b'] });
   * ```
   */
  const handleNestedDocumentMove = async (move: {
    documentId: string;
    parent: string | null;
    order: string[];
  }) => {
    const moved = docs.find((doc) => doc.id === move.documentId);
    if (!moved) return false;

    // The row on screen, as a save names it
    let url = `${apiUrl(config.kebab, moved.id)}/move`;
    if (moved.versionId) {
      url += `?${PARAMS.VERSION_ID}=${moved.versionId}`;
    }
    const [error] = await trycatchFetch(url, {
      method: 'POST',
      body: JSON.stringify({ parent: move.parent, order: move.order }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (error) console.error(error);

    // The proxy's reads of the collection (a page's children) read again.
    APIProxy.invalidate(apiUrl(config.kebab));
    // The stored order, drafts included, becomes the list's documents, as after a delete
    await invalidateAll();
    return !error;
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

  /**
   * Narrows the list to the documents whose title matches `inputValue`, the best match first.
   * An empty search shows every document again, in the order picked.
   */
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
      writeStored(storageKey('display'), mode);
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
