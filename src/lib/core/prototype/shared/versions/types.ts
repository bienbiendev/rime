import type { BaseDoc } from '$lib/core/prototype/types.js';
import type { VersionsStatus } from './constant.js';

/**
 * What a version row reads as.
 *
 * Was in `core/prototype/types.ts`, which is what made that file import `VersionsStatus` out of
 * this feature to describe its own registry.
 */
export type VersionDoc = BaseDoc & {
  status: VersionsStatus;
};

declare module '$lib/core/prototype/types.js' {
  interface FeatureDocTypes {
    version: VersionDoc;
  }
}

/**
 * What an author writes under `versions`. Lived in `core/config/types.ts`, which is what made
 * core own the shape of a thing only this folder reads.
 */
export type VersionsConfig = { draft?: boolean; autoSave?: boolean; maxVersions?: number };

/** An auto-saved row, as the panel load hands it to the page: whose typing, and from when. */
export type AutoSave = {
  id: string;
  updatedAt: Date;
  updatedBy: { id: string; name?: string; email?: string } | null;
};

/** A document's auto-saved rows, newest first. */
export type AutoSaves = AutoSave[];
