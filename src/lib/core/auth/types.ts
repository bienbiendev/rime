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

import type { Option } from '$lib/fields/types.js';
import type { Access } from '$lib/core/config/types.js';
import type { CollectionLabel } from '$lib/core/prototype/collection/types.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';

/** What an author writes under `auth`, and what `staff` may be extended with. */
export type CollectionAuthConfig = (
  | {
      type: 'password';
    }
  | { type: 'apiKey' }
) & {
  roles?: (string | Option)[];
};

export type AdditionalStaffConfig = {
  roles?: (string | Option)[];
  panel?: {
    group?: string;
  };
  access?: Access;
  label?: CollectionLabel;
  fields?: FieldBuilder<Field>[];
};
