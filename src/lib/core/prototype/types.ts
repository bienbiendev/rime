import type { GetRegisterType, RegisterArea, RegisterCollection } from '$lib/index.js';

export type CollectionSlug = GetRegisterType<'CollectionSlug'>;
export type AreaSlug = GetRegisterType<'AreaSlug'>;
export type PrototypeSlug = CollectionSlug | AreaSlug;

import type { Dic } from '$lib/util/types.js';
import type { FeatureDocTypes } from '../features/register.js';

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

/**
 * Every document shape there is, by the name a `DocType` uses for it.
 *
 * Three sources, and none of them is a list kept here. The two below are core's own — anything is
 * a raw row or a document. `FeatureDocTypes` is what the features contribute (`upload`, `version`,
 * `auth`, `directory`), each declared beside the feature that means it. `RegisterCollection` and
 * `RegisterArea` are what codegen writes for the configs in the build.
 *
 * The four feature shapes were spelled out here, which is why this file imported `UploadPath` and
 * `VersionsStatus` out of two features to describe its own registry.
 */
export type Docs = {
  raw: RawDoc;
  generic: GenericDoc;
} & FeatureDocTypes &
  RegisterCollection &
  RegisterArea;

export type DocType = keyof Docs;
