import type { GetRegisterType, RegisterArea, RegisterCollection } from '$lib/index.js';

export type CollectionSlug = GetRegisterType<'CollectionSlug'>;
export type AreaSlug = GetRegisterType<'AreaSlug'>;
export type PrototypeSlug = CollectionSlug | AreaSlug;

import type { Dic } from '$lib/util/types.js';
import type { UploadPath } from '../collections/upload/util/path.js';
import type { VersionsStatus } from '../constant.js';

export type Prototype = 'area' | 'collection';

export type RawDoc = Dic & { id: string };

export type BaseDoc = {
	id: string;
	title: string;
	updatedAt?: Date;
	createdAt?: Date;
	locale?: string;
	url?: string | null;
	_prototype: Prototype;
	_type: PrototypeSlug;
	_live?: string;
};

export type GenericDoc = BaseDoc & Dic;
export type GenericNestedDoc = BaseDoc & {
	_children: string[];
	_parent: string | null;
	_position: number;
} & Dic;

export type GenericAuthDoc = BaseDoc & {
	apiKeyId?: string;
	authUserId?: string;
	roles?: string[];
} & Dic;

export type TreeBlock = {
	id: string;
	ownerId?: string;
	path?: string;
	position?: number;
	_children: TreeBlock[];
} & Dic;

export type GenericBlock<T extends string = string> = {
	id: string;
	type: T;
	ownerId?: string;
	position?: number;
	path?: string;
} & Dic;

export type UploadDoc = BaseDoc & {
	mimeType: string;
	filesize: string;
	filename: string;
	url: string;
	sizes: { [key: string]: string };
} & Dic;

export type VersionDoc = BaseDoc & {
	status: VersionsStatus;
};

export type Docs = {
	raw: RawDoc;
	generic: GenericDoc;
	upload: UploadDoc;
	version: VersionDoc;
	auth: GenericAuthDoc;
	directory: {
		id: UploadPath;
		parent: string | null;
		name: string;
		createdAt: Date;
		updatedAt: Date;
	};
} & RegisterCollection &
	RegisterArea;

export type DocType = keyof Docs;
