import { ROLES, STAFF_SLUG } from '#lib/core/auth/constant.js';
import type { Collection } from '#lib/core/config/types.js';
import type { CollectionAuthConfig } from '#lib/core/auth/types.js';
import { access } from '#lib/core/auth/access.js';
import { email } from '#lib/fields/email/index.js';
import { select } from '#lib/fields/select/index.js';
import { text } from '#lib/fields/text/index.js';
import type { Option } from '#lib/types.js';

const emailField = email('email')
  .access({
    create: () => true,
    read: (user) => !!user,
    update: () => false
  })
  .required()
  .unique();

const nameField = text('name')
  .access({
    create: () => true,
    read: (user) => !!user,
    update: () => false
  })
  .required();

type Input = {
  slug: string;
  auth?: boolean | CollectionAuthConfig;
  fields?: Collection<any>['fields'];
};
export type WithNormalizedAuth<T> = Omit<T, 'auth'> & { auth?: CollectionAuthConfig };

const withNormalizedAuth = <T extends { auth?: boolean | CollectionAuthConfig }>(
  config: T
): WithNormalizedAuth<T> => {
  // Create a new object without the auth property
  const { auth, ...rest } = config;
  // Determine the normalized auth value
  let normalizedAuth: undefined | CollectionAuthConfig;

  if (typeof auth === 'boolean') {
    normalizedAuth = { type: 'password' };
  } else {
    normalizedAuth = auth;
  }

  // Return the new object with the normalized auth
  return {
    ...rest,
    auth: normalizedAuth
  };
};

/**
 * Augments an auth collection: normalizes `config.auth`, adds the `name`, `email` and `roles`
 * fields (`apiKeyId` and `ownerId` instead of `email` for api-key auth), and sets
 * `_titleFallback`. Throws when no default role remains.
 */
export const augmentAuth = <T extends Input>(config: T): WithNormalizedAuth<T> => {
  const normalizedAuthConfig = withNormalizedAuth(config) as WithNormalizedAuth<T> & {
    auth: CollectionAuthConfig;
  };

  // Augment Fields
  const IS_STAFF_COLLECTION = normalizedAuthConfig.slug === STAFF_SLUG;
  const IS_GENERIC_COLLECTION = !IS_STAFF_COLLECTION;
  const IS_API_AUTH = normalizedAuthConfig.auth.type === 'apiKey';

  const roles = [...(normalizedAuthConfig.auth.roles || [ROLES.USER])];
  const normalizedRoles: Option[] = roles.map((r) => (typeof r === 'string' ? { value: r } : r));

  const defaultRole = normalizedRoles.filter((r) => r.value !== ROLES.ADMIN)[0];

  if (!defaultRole) {
    throw Error('Missing default role');
  }

  // Define role field
  const rolesField = select('roles')
    .options(...roles)
    // Never saved empty: an account without a role has the default one.
    .defaultValue([defaultRole.value], { fill: 'save' })
    .many()
    .required();

  if (IS_GENERIC_COLLECTION) {
    rolesField.access({
      create: () => true,
      read: (user) => !!user,
      update: (user) => access.isStaff(user)
    });
  } else {
    rolesField.access({
      create: (user) => !!user && access.isAdmin(user),
      read: (user) => !!user && access.isAdmin(user),
      update: (user) => !!user && access.isAdmin(user)
    });
  }

  const fields = [
    nameField,
    // Add email field for non api key auth type.
    ...(!IS_API_AUTH ? [emailField] : []),
    rolesField,
    ...(normalizedAuthConfig.fields || []),
    // Add apiKeyId for api key auth type.
    ...(IS_API_AUTH
      ? [
          text('apiKeyId')
            .hidden()
            .access({ update: () => false })
        ]
      : [])
  ];

  if (IS_API_AUTH) {
    const ownerIdField = text('ownerId')
      .hidden()
      .access({ update: () => false });
    fields.push(ownerIdField);
  }

  // Names an auth document by `email`, or by `name` for api-key auth. `augmentUpload` runs later
  // and overrides it.
  const _titleFallback = IS_API_AUTH ? 'name' : 'email';

  return { ...normalizedAuthConfig, fields, _titleFallback };
};
