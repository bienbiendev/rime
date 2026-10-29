import type { BaseDoc } from '#lib/core/prototype/types.js';
import type { Dic } from '#lib/util/types.js';
import type { Option } from '#lib/fields/types.js';
import type { Access } from '#lib/core/config/types.js';
import type { CollectionLabel } from '#lib/core/prototype/collection/types.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';

/**
 * What a document of a collection that signs in carries beyond a plain one.
 */
export type GenericAuthDoc = BaseDoc & {
  apiKeyId?: string;
  authUserId?: string;
  roles?: string[];
} & Dic;

declare module '../prototype/types.js' {
  interface FeatureDocTypes {
    auth: GenericAuthDoc;
  }
}

/**
 * The signed-in user, `event.locals.user`: built by `userAttributes` from the user's document, or
 * by `apiKeyUser` for a request that sends an api key.
 */
export type User = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isStaff?: boolean;
  isSuperAdmin?: boolean;
};

/** What an author writes under a collection's `auth`. */
export type CollectionAuthConfig = (
  | {
      type: 'password';
    }
  | { type: 'apiKey' }
) & {
  roles?: (string | Option)[];
};

/** What `config.staff` adds to the staff collection: roles, fields, access, panel group, label. */
export type AdditionalStaffConfig = {
  roles?: (string | Option)[];
  panel?: {
    group?: string;
  };
  access?: Access;
  label?: CollectionLabel;
  fields?: FieldBuilder<Field>[];
};
