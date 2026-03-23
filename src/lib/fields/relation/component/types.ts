import type { BuiltCollection } from '$lib/core/config/types.js';
import type { GenericDoc } from '$lib/core/types/doc.js';

export type RelationFieldItem = {
	id?: string;
	documentId: string;
	title: string;
	filename?: string;
	filesize?: string;
	mimeType?: string;
	isImage?: boolean;
	url?: string;
	livePreview?: GenericDoc;
	editUrl: string;
	_type: string;
	_prototype: string;
};

export type RelationComponentProps = {
	path: string;
	relationConfig: BuiltCollection;
	stamp: string;
	hasError: boolean;
	isFull: boolean;
	readOnly: boolean;
	nothingToSelect: boolean;
	many: boolean;
	addValue: (relationToId: string) => void;
	removeValue: (relationToId: string) => void;
	availableItems: RelationFieldItem[];
	selectedItems: RelationFieldItem[];
	formNestedLevel: number;
	onOrderChange: (oldIndex: number, newIndex: number) => void;
	onRelationCreated: (doc: GenericDoc) => void;
	onRelationCreationCanceled: () => void;
	onRelationCreation: () => void;
};
