import { defaultStatements, adminAc, userAc } from 'better-auth/plugins/admin/access';
import { createAccessControl } from 'better-auth/plugins/access';

/** The statements better-auth's admin plugin checks. */
export const accessControl = createAccessControl(defaultStatements);

/**
 * The better-auth role of a rime admin: every admin statement. rime uses two of them from the
 * server, `create` (with `set-role`) and `set-role`; the HTTP routes are closed.
 */
export const admin = accessControl.newRole(adminAc.statements);
/** Panel users who are not admins: no better-auth admin endpoint, rime's access rules decide. */
export const staff = accessControl.newRole({ user: [], session: [] });
export const user = accessControl.newRole(userAc.statements);
