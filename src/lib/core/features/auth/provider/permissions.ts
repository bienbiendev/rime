import { defaultStatements, adminAc, userAc } from 'better-auth/plugins/admin/access';
import { createAccessControl } from 'better-auth/plugins/access';

export const accessControl = createAccessControl(defaultStatements);

export const admin = accessControl.newRole(adminAc.statements);
export const staff = accessControl.newRole({
  user: ['create', 'list', 'delete']
});
export const user = accessControl.newRole(userAc.statements);
