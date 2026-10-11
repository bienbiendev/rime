import { ROLES, STAFF_SLUG } from '../constant.js';
import type { CollectionWithoutSlug } from '#lib/core/prototype/collection/types.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field, Option } from '#lib/types.js';
import { access } from '#lib/core/auth/access.js';
import UsersRound from '@lucide/svelte/icons/users-round';
import cloneDeep from 'clone-deep';
import type { Access } from '#lib/core/config/types.js';
import type { AdditionalStaffConfig } from '#lib/core/auth/types.js';

const staffCollection = {
  label: { singular: 'User', plural: 'Users' },
  panel: {
    description: 'Manage who can access your admin panel',
    group: 'system'
  },
  auth: {
    type: 'password',
    roles: [ROLES.ADMIN, ROLES.STAFF] as (string | Option)[]
  },
  icon: UsersRound,
  fields: [] as FieldBuilder<Field>[],
  access: {
    // Any staff member, not just an admin: the panel shows who made a document and who is
    // holding its edit lock, and that name has to be readable by whoever is looking at it.
    // `roles` keeps its own admin-only read (auth/augment.ts).
    read: (user) => access.isStaff(user),
    create: (user) => access.isAdmin(user),
    delete: (user) => access.isAdmin(user),
    // An admin, or a staff member on their own document: a user of another auth collection is
    // never "me" here, whatever id they send
    update: (user, { id }) =>
      access.isAdmin(user) || (access.isStaff(user) && access.isMe(user, id))
  } as Access
};

export const getStaffCollection = ({
  roles: incomingRoles = [],
  fields = [],
  access,
  panel,
  label
}: AdditionalStaffConfig = {}) => {
  const staffConfig = cloneDeep(staffCollection) as typeof staffCollection;
  let roles: Option[] = incomingRoles.map((role) =>
    typeof role === 'string' ? { value: role } : role
  );

  const hasAdminRole = roles.find((role) => role.value === ROLES.ADMIN);
  const otherRoles = roles.filter((role) => role.value !== ROLES.ADMIN);

  // Add admin role on Staff collection if not present
  if (!hasAdminRole) {
    roles = [{ value: ROLES.ADMIN }, ...roles];
  }

  // If there is no other roles than admin add a staff role
  if (otherRoles.length === 0) {
    roles.push({ value: ROLES.STAFF });
  }

  // Options, so an authored label reaches the roles select
  staffConfig.auth.roles = roles;

  staffConfig.fields.push(...fields);
  if (access) {
    staffConfig.access = {
      ...staffConfig.access,
      ...access
    };
  }
  if (panel?.group) {
    staffConfig.panel = { ...staffConfig.panel, group: panel.group };
  }
  if (label) {
    staffConfig.label = label;
  }

  return staffConfig as CollectionWithoutSlug<typeof STAFF_SLUG>;
};
