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

/**
 * A document's auto-saved rows, as the panel load hands them to the page: the caller's own, and
 * everybody else's. `outdated` says the row on screen was written after the caller's auto-save
 * started.
 */
export type AutoSaves = {
  own?: { id: string; createdAt: Date; updatedAt: Date; outdated: boolean };
  others: {
    id: string;
    updatedAt: Date;
    updatedBy: { id: string; name?: string; email?: string } | null;
  }[];
};
