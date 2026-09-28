import { invalidateAll } from '$app/navigation';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { PARAMS } from '$lib/core/constants.js';
import type { FieldBuilder } from '$lib/core/fields/builders/index.js';
import { isFormField } from '$lib/core/fields/util.js';
import { walkFields } from '$lib/core/fields/walk.js';
import { directoriesKebab } from '$lib/core/prototype/collection/upload/naming.js';
import type { Directory } from '$lib/core/prototype/collection/upload/types.js';
import { isUploadConfig } from '$lib/core/prototype/collection/upload/util/config.js';
import { toNestedStructure } from '$lib/core/prototype/collection/nested/tree.js';
import type { GenericDoc, GenericNestedDoc } from '$lib/core/prototype/types.js';
import { apiUrl, panelUrl } from '$lib/core/routes/util.js';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import type { FormField } from '$lib/fields/types.js';
import type { FieldPanelTableConfig } from '$lib/panel/types.js';
import {
  fileSizeBytes,
  mediaKind,
  MEDIA_KINDS,
  type MediaKind
} from '$lib/panel/util/upload-file.js';
import { trycatch, trycatchFetch } from '$lib/util/function.js';
import { getValueAtPath, hasProp } from '$lib/util/object.js';
import type { WithRequired } from '$lib/util/types.js';
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
export type DisplayMode = (typeof DISPLAY_MODE)[keyof typeof DISPLAY_MODE];
export type StatusFilter = 'all' | typeof VERSIONS_STATUS.DRAFT | typeof VERSIONS_STATUS.PUBLISHED;
export type KindFilter = 'all' | MediaKind;

export const DISPLAY_MODE = {
  LIST: 'display_list',
  GRID: 'display_grid',
  NESTED: 'display_nested'
} as const;

function createCollectionStore<T extends GenericDoc = GenericDoc>(args: Args<T>) {
  const { initial, config, canCreate, upload: incomingUpload } = args;

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
    currentPath: incomingUpload?.currentPath || 'root',
    parentDirectory: incomingUpload?.parentDirectory || null
  });
  let isFiltered = $state(false);
  /** The search as typed. */
  let query = '';
  let stamp = $state(Date.now()); // Timestamp to invalidate on changes
  const hasVersions = $derived(!!config.versions);
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
   * The path of a document, after its title: the pathname of its url, else its slug.
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

  const columns = buildFieldColumns(config.fields)
    .map((col) => {
      // Set column position
      let tableConfig: FieldPanelTableConfig = { position: 99 };
      if (typeof col.table === 'number') {
        tableConfig.position = col.table;
      } else if (typeof col.table === 'object' && 'position' in col.table) {
        tableConfig = { ...col.table, position: col.table.position || 99 };
      }
      return { ...col, table: tableConfig };
    })
    .sort((a, b) => a.table.position - b.table.position);

  /** The documents in the order picked, by `sortingBy` then `sortingOrder`. */
  function sorted(list: T[]) {
    const orderMult = sortingOrder === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (a[sortingBy] < b[sortingBy]) {
        return -1 * orderMult;
      }
      if (a[sortingBy] > b[sortingBy]) {
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
      // Else sort by field asc
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
    const [error] = await trycatchFetch(deleteUrl, {
      method: 'DELETE'
    });

    if (error) {
      console.error(error);
      toast.error('An error occured while deleting documents');
    } else {
      toast.success(`Successfully deleted ${ids.length} docs`);
    }
    await invalidateAll();
  };

  /**
   * Handle document move operations with parent-child relationships
   * @param params Object containing from and to information
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
    // 1. Create a new array to track changes
    const updatedDocs = [...docs] as GenericNestedDoc[];
    const docToMove = updatedDocs.find((d) => d.id === documentId);
    if (!docToMove) return;

    // 2. Track all documents that need updating
    const docsToUpdate = new Map<string, GenericDoc>();

    // 3. Remove from old parent's children
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

    // 4. Add to new parent's children
    if (to.parent !== null) {
      const newParent = updatedDocs.find((d) => d.id === to.parent);
      if (newParent) {
        const newChildren = [...(newParent._children || [])];
        newChildren.splice(to.index, 0, documentId);
        newParent._children = newChildren;
        docsToUpdate.set(newParent.id, newParent);
      }
    }

    // 5. Update the moved document
    docToMove._parent = to.parent;
    docToMove._position = to.index;
    docsToUpdate.set(docToMove.id, docToMove);

    // 6. Update positions for all affected siblings
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

    // 7. Update local state optimistically
    docs = updatedDocs as T[];
    stamp = Date.now();

    // 8. Send updates to API
    try {
      await apiUpdateNestedStructure(Array.from(docsToUpdate.values()));
      return true;
    } catch (error) {
      console.error('Failed to update documents:', error);
      // Revert to current database docs
      docs = await fetch(apiUrl(config.kebab))
        .then((r) => r.json())
        .then((r) => r.docs);
      stamp = Date.now();
      return false;
    }
  };

  /**
   * Update the nested structure via API calls and regenerate URLs for documents
   * @param docsToUpdate Array of documents that need updating
   * @returns Promise that resolves to true if all updates succeeded
   */
  const apiUpdateNestedStructure = async (docsToUpdate: GenericDoc[]) => {
    const promises = docsToUpdate.map((doc) => {
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
    });
    const [error] = await trycatch(() => Promise.all(promises));

    if (error) {
      console.error('API update failed:', error);
      throw error;
    }

    return true;
  };

  function isList() {
    return displayMode === DISPLAY_MODE.LIST;
  }
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

  function filterBy(inputValue: string) {
    query = inputValue;
    if (inputValue !== '') {
      isFiltered = true;
      const scores: any[] = [];
      for (const doc of initialDocs) {
        const asTitle = getValueAtPath<string>(config.asTitle, doc);
        if (!asTitle) continue;
        const score = computeCommandScore(asTitle, inputValue);
        if (score > 0) {
          scores.push({
            doc,
            score
          });
        }
      }
      const results = scores.sort(function (a, b) {
        if (a.score === b.score) {
          const titleA = getValueAtPath<string>(config.asTitle, a.doc);
          const titleB = getValueAtPath<string>(config.asTitle, b.doc);
          if (titleA && titleB) {
            return titleA.localeCompare(titleB);
          }
        }
        return b.score - a.score;
      });
      docs = results.map((r) => r.doc);
    } else {
      isFiltered = false;
      docs = sorted([...initialDocs]);
    }
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

    get hasVersions() {
      return hasVersions;
    },

    get panelUrl() {
      return panelUrl(config.kebab);
    },

    get apiUrl() {
      return apiUrl(config.kebab);
    },

    get apiDirectoriesUrl() {
      if (!config.upload) throw new Error(`${config.slug} is not an upload collection`);
      return apiUrl(directoriesKebab(config.slug));
    },

    config,
    canCreate,
    isList,
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
    /** On while a document is checked; turning it off drops the selection. */
    get selectMode() {
      return selected.length > 0;
    },
    set selectMode(bool) {
      if (!bool) selected = [];
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

    deleteDocs,
    get docs() {
      return docs;
    },
    /** A reload: the search runs again over the new documents, in the order picked. */
    set docs(value) {
      initialDocs = value;
      untrack(() => filterBy(query));
      stamp = Date.now();
    },
    get length() {
      return docs.length;
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
    currentPath?: `root${string}`;
    parentDirectory?: Directory;
  };
};
