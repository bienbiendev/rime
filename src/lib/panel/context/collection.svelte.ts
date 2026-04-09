import { invalidateAll } from '$app/navigation';
import { apiUrl } from '$lib/core/api/index.js';
import type { Directory } from '$lib/core/collections/upload/upload.js';
import { isUploadConfig } from '$lib/core/collections/upload/util/config.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { PARAMS } from '$lib/core/constant.js';
import type { FieldBuilder } from '$lib/core/fields/builders/index.js';
import { isFormField } from '$lib/core/fields/util.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import type { GenericDoc, GenericNestedDoc } from '$lib/core/types/doc.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import type { FormField } from '$lib/fields/types.js';
import type { FieldPanelTableConfig } from '$lib/panel/types.js';
import { panelUrl } from '$lib/panel/util/url.js';
import { toNestedStructure } from '$lib/util/doc.js';
import { trycatch, trycatchFetch } from '$lib/util/function.js';
import { getValueAtPath, hasProp } from '$lib/util/object.js';
import type { WithRequired } from '$lib/util/types.js';
import { getContext, onMount, setContext, type Component } from 'svelte';
import { toast } from 'svelte-sonner';
//@ts-expect-error command-score has no types
import commandScore from 'command-score';

type TableColumn = {
	type: string;
	path: string;
	cell: null | Component<{ value: any }>;
	table: FieldPanelTableConfig;
};

type SortMode = 'asc' | 'dsc';
export type DisplayMode = (typeof DISPLAY_MODE)[keyof typeof DISPLAY_MODE];

export const DISPLAY_MODE = {
	LIST: 'display_list',
	GRID: 'display_grid',
	NESTED: 'display_nested'
} as const;

function createCollectionStore<T extends GenericDoc = GenericDoc>(args: Args<T>) {
	const { initial, config, canCreate, upload: incomingUpload } = args;

	let initialDocs = $state.raw(initial);
	let docs = $state(initial);
	let sortingOrder = $state<SortMode>('asc');
	let sortingBy = $state<string>('updatedAt');
	let selectMode = $state(false);
	let selected = $state<string[]>([]);
	let displayMode = $state<DisplayMode>(DISPLAY_MODE.LIST);
	let upload = $state({
		directories: incomingUpload?.directories || [],
		currentPath: incomingUpload?.currentPath || 'root',
		parentDirectory: incomingUpload?.parentDirectory || null
	});
	let isFiltered = $state(false);
	let stamp = $state(Date.now()); // Timestamp to invalidate on changes
	const hasVersions = $derived(!!config.versions);
	const hasDraft = $derived(config.versions && config.versions.draft);

	onMount(() => {
		displayMode =
			(localStorage.getItem(`collection.${config.slug}.display`) as DisplayMode) ||
			DISPLAY_MODE.LIST;
		const localSortBy = localStorage.getItem(`collection.${config.slug}.sortBy`);
		sortingBy = localSortBy || 'updatedAt';
		const localSortOrder = localStorage.getItem(`collection.${config.slug}.sortOrder`) as SortMode;
		sortingOrder = localSortOrder || 'asc';
		if (localSortBy) {
			sortBy(sortingBy, false);
		}
	});

	$effect(() => {
		if (!selectMode) selected = [];
	});

	const nested = $derived.by(() => {
		return toNestedStructure(docs);
	});

	const buildFieldColumns = (fields: FieldBuilder[], parentPath: string = '') => {
		let columns: TableColumn[] = [];
		for (const field of fields) {
			if (field instanceof GroupFieldBuilder) {
				// For group fields, pass the current group name as parent path for nested fields
				const groupPath = parentPath ? `${parentPath}.${field.raw.name}` : field.raw.name;
				columns = [...columns, ...buildFieldColumns(field.raw.fields, groupPath)];
			}
			if (isFormField(field.raw) && hasProp('table', field.raw)) {
				// Create current field path
				const path = parentPath ? `${parentPath}.${field.raw.name}` : field.raw.name;
				// Create column
				const column = {
					type: field.type,
					path,
					cell: field.raw.table.cell || field.cell,
					table: field.raw.table
				};
				columns.push(column);
			} else if (field instanceof TabsBuilder) {
				for (const tab of field.raw.tabs) {
					// For tab fields, create a path with the tab name
					const path = parentPath ? `${parentPath}.${tab.raw.name}` : tab.raw.name;
					columns = [...columns, ...buildFieldColumns(tab.raw.fields, path)];
				}
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

	const sortBy = (fieldName: string, toggle: boolean = true) => {
		if (sortingBy === fieldName) {
			if (toggle) {
				sortingOrder = sortingOrder === 'asc' ? 'dsc' : 'asc';
			}
		} else {
			// Else sort by field asc
			sortingBy = fieldName;
		}
		// Do sorting logic
		const orderMult = sortingOrder === 'asc' ? 1 : -1;
		docs = docs.sort((a, b) => {
			if (a[fieldName] < b[fieldName]) {
				return -1 * orderMult;
			}
			if (a[fieldName] > b[fieldName]) {
				return 1 * orderMult;
			}
			return 0;
		});
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
		return displayMode === DISPLAY_MODE.NESTED;
	}

	function toggleSelectOf(docId: string) {
		if (selected.includes(docId)) {
			selected = selected.filter((id) => id !== docId);
		} else {
			selected.push(docId);
		}
	}

	function selectAll() {
		if (config.upload) {
			selected = docs.filter((doc) => doc._path === upload.currentPath).map((doc) => doc.id);
		} else {
			selected = docs.map((doc) => doc.id);
		}
	}

	async function deleteSelection() {
		deleteDocs(selected);
		selectMode = false;
	}

	function filterBy(inputValue: string) {
		if (inputValue !== '') {
			isFiltered = true;
			const scores: any[] = [];
			for (const doc of initialDocs) {
				const asTitle = getValueAtPath(config.asTitle, doc);
				if (!asTitle) continue;
				const score = commandScore(asTitle, inputValue);
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
			docs = [...initialDocs];
		}
	}

	async function deleteDoc(id: string) {
		const res = await fetch(`/api/${config.kebab}/${id}`, {
			method: 'DELETE',
			headers: {
				'content-type': 'application/json'
			}
		});
		if (res.status === 200) {
			docs = [...docs].filter((doc) => doc.id !== id);
		} else if (res.status === 404) {
			console.error('not found');
		}
	}

	function addDoc(doc: T) {
		docs.push(doc);
		sortBy(sortingBy, false);
	}

	function updateDoc(incomingDoc: T) {
		for (const [index, doc] of docs.entries()) {
			if (doc.id === incomingDoc.id) {
				docs[index] = incomingDoc;
				return;
			}
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
			return apiUrl(withDirectoriesSuffix(config.kebab));
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
		get selectMode() {
			return selectMode;
		},
		set selectMode(bool) {
			selectMode = bool;
		},
		get isAllSelected() {
			if (config.upload) {
				return selected.length === docs.filter((d) => d._path === upload.currentPath).length;
			} else {
				return selected.length === docs.length;
			}
		},

		deleteSelection,
		filterBy,

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

		/****************************************************/
		// Docs
		/****************************************************/
		addDoc,
		updateDoc,
		deleteDoc,
		deleteDocs,
		get docs() {
			return docs;
		},
		set docs(value) {
			docs = value;
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

const COLLECTION_KEY = 'rime.collection';

export function setCollectionContext(args: Args) {
	const store = createCollectionStore(args);
	return setContext(`${COLLECTION_KEY}.${args.key || 'root'}`, store);
}

export function getCollectionContext(key: string = 'root') {
	return getContext<CollectionContext>(`${COLLECTION_KEY}.${key}`);
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
	key?: string;
};
