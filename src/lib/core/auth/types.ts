import type { BaseDoc } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';

/**
 * What a document of a collection that signs in carries beyond a plain one.
 *
 * Was in `core/prototype/types.ts`, spelled into the `Docs` registry by core.
 */
export type GenericAuthDoc = BaseDoc & {
  apiKeyId?: string;
  authUserId?: string;
  roles?: string[];
} & Dic;

declare module '$lib/core/prototype/types.js' {
  interface FeatureDocTypes {
    auth: GenericAuthDoc;
  }
}

export type User = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isStaff?: boolean;
  isSuperAdmin?: boolean;
};
