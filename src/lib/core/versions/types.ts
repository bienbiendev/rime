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
