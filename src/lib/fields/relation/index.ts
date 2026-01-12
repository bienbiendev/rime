import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { PARAMS } from '$lib/core/constant';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/types/doc.js';
import type {
	DefaultValueFn,
	Field,
	FieldHookShared,
	FormField,
	RelationValue
} from '$lib/fields/types.js';
import type { RegisterCollection } from '$lib/index.js';
import { trycatchFetch } from '$lib/util/function';
import { hasProps, isObjectLiteral } from '$lib/util/object.js';
import Cell from './component/Cell.svelte';
import RelationComponent from './component/Relation.svelte';

export const ensureRelationExists: FieldHookShared = async (
	value: RelationValue<any>,
	{ config }
) => {
	// Skip relation validation on panel as it will be done server-side
	if (browser) return value;

	const getRequsetEvent = await import('$app/server').then((m) => m.getRequestEvent);
	const output = [];

	const retrieveRelation = async (id: string) => {
		const [err, response] = await trycatchFetch(
			`${env.PUBLIC_RIME_URL}/api/${config.relationTo}/${id}?${PARAMS.SELECT}=id`,
			{
				method: 'GET',
				headers: getRequsetEvent().request.headers
			}
		);
		if (err) return null;
		const { doc } = await response.json();
		return doc;
	};

	if (value && Array.isArray(value)) {
		for (const relation of value) {
			let documentId;
			if (typeof relation === 'string') {
				documentId = relation;
			} else {
				documentId = relation.documentId;
			}
			if (!documentId) {
				continue;
			}
			const doc = await retrieveRelation(documentId);
			if (doc) {
				output.push(relation);
			}
		}
	} else if (typeof value === 'string') {
		const doc = await retrieveRelation(value);
		if (doc) {
			output.push(doc.id);
		}
	}

	return output;
};

export class RelationFieldBuilder<Doc extends GenericDoc> extends FormFieldBuilder<
	RelationField<Doc>
> {
	//
	_metaUrl = import.meta.url;

	constructor(name: string) {
		super(name, 'relation');
		this.field.isEmpty = (value) => !value || (Array.isArray(value) && value.length === 0);
		this.field.defaultValue = [];
		this.field.hooks = {
			beforeValidate: [ensureRelationExists]
		};
	}

	get component() {
		return RelationComponent;
	}

	get cell() {
		return Cell;
	}

	isThumbnail(bool = true) {
		this.field.isThumbnail = bool;
		return this;
	}

	query(query: string | QueryResolver<Doc>) {
		(this.field as RelationField<Doc>).query = query;
		return this;
	}

	to<Slug extends CollectionSlug>(slug: Slug): RelationFieldBuilder<RegisterCollection[Slug]> {
		this.field.relationTo = slug;
		return this as unknown as RelationFieldBuilder<RegisterCollection[Slug]>;
	}

	many() {
		this.field.many = true;
		return this;
	}
	defaultValue(value: string | string[] | DefaultValueFn<string | string[]>) {
		this.field.defaultValue = value;
		return this;
	}
}

export const relation = (name: string) => new RelationFieldBuilder(name);

/**
 * Checks if a field is a relation field.
 */
export const isRelationField = (field: Field): field is RelationField => field.type === 'relation';

/**
 * Checks if a relation value is resolved (contains the actual referenced document).
 *
 * @example
 * // Returns true for a resolved relation
 * isRelationResolved({ title: 'Home Page', _prototype: 'collection', _type: 'pages' });
 */
export const isRelationResolved = <T>(value: any): value is T => {
	return value && isObjectLiteral(value) && hasProps(['title', '_prototype', '_type'], value);
};

/**
 * Checks if a relation value is unresolved (contains only reference information).
 *
 * @example
 * // Returns true for an unresolved relation
 * isRelationUnresolved({ relationTo: 'pages', documentId: '123' });
 */
export const isRelationUnresolved = (
	value: any
): value is Omit<Relation, 'path' | 'position' | 'ownerId'> => {
	return value && isObjectLiteral(value) && hasProps(['relationTo', 'documentId'], value);
};

/**
 * Resolves a relation by fetching the referenced document.
 * If the relation is already resolved, returns it as is.
 *
 * @example
 * // Resolves a relation to its full document
 * const page = await resolveRelation({ relationTo: 'pages', documentId: '123' });
 */
export const resolveRelation = async <T>(value: any): Promise<T> => {
	if (isRelationResolved<T>(value)) {
		return value;
	}
	return (await fetch(`api/${value.relationTo}/${value.documentId}`)
		.then((r) => r.json())
		.then((r) => r.doc)) as T;
};

/****************************************************/
/* Type
/****************************************************/

export type RelationField<Doc extends GenericDoc = GenericDoc> = FormField & {
	type: 'relation';
	relationTo: CollectionSlug;
	layout?: 'tags' | 'list';
	many?: boolean;
	defaultValue?: string | string[] | DefaultValueFn<string | string[]>;
	query?: string | ((doc: Doc) => string);
	isThumbnail?: boolean;
};

export type Relation = {
	id?: string;
	ownerId: string;
	path: string;
	position: number;
	relationTo: string;
	documentId: string;
	locale?: string;
	livePreview?: GenericDoc;
};

type QueryResolver<Doc extends GenericDoc = GenericDoc> = (doc: Doc) => string;
