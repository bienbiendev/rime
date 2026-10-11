import { dev } from '$app/env';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import { SITE_URL } from '$app/env/public';
import type { MailerActions } from '#lib/core/plugins/mailer/index.server.js';
import type { ConfigContext } from '#lib/core/rime.server.js';
import type { Config } from '#lib/types.js';
import { apiKey } from '@better-auth/api-key';
import { admin as adminPlugin } from 'better-auth/plugins';
import type { BuildConfig } from '#lib/core/config/index.server.js';
import { betterAuthAfterHook, betterAuthBeforeHook } from './hooks.server.js';
import { accessControl, admin, staff, user } from './permissions.js';

/**
 * better-auth routes rime never calls over HTTP. Each one writes a user past rime's access and
 * hooks: an `authUserId` row goes with its better-auth user, by cascade. rime calls the admin
 * routes it needs from the server, which this list does not reach.
 */
const CLOSED_PATHS = [
  '/delete-user',
  '/delete-user/callback',
  '/update-user',
  '/change-email',
  '/admin/set-role',
  '/admin/get-user',
  '/admin/create-user',
  '/admin/update-user',
  '/admin/list-users',
  '/admin/list-user-sessions',
  '/admin/ban-user',
  '/admin/unban-user',
  '/admin/impersonate-user',
  '/admin/stop-impersonating',
  '/admin/revoke-user-session',
  '/admin/revoke-user-sessions',
  '/admin/remove-user',
  '/admin/set-user-password',
  '/admin/has-permission'
];

export function getBaseAuthConfig<const C extends Config>(ctx: {
  mailer: MailerActions | undefined;
  config: ConfigContext<C>;
}) {
  const betterAuthOptions = {
    baseURL: SITE_URL,
    secret: BETTER_AUTH_SECRET,
    disabledPaths: CLOSED_PATHS,
    plugins: configurePlugins(ctx.config.raw),
    rateLimit: {
      enabled: !dev,
      window: 10,
      max: 30
    },
    trustedOrigins: ctx.config.raw.$trustedOrigins,
    session: {
      modelName: 'authSessions'
    },
    account: {
      modelName: 'authAccounts'
    },
    verification: {
      modelName: 'authVerifications'
    },
    user: {
      modelName: 'authUsers',
      additionalFields: {
        type: {
          type: 'string',
          required: true
        }
      }
    },
    hooks: {
      before: betterAuthBeforeHook,
      after: betterAuthAfterHook
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async (data: { user: any; url: string }) => {
        if (!ctx.mailer) throw Error('Mailer is not configured');
        await ctx.mailer.sendMail({
          to: data.user.email,
          subject: 'Reset your password',
          text: `Click the link to reset your password: ${data.url}`
        });
      }
    }
  } as const;

  return betterAuthOptions;
}

const configurePlugins = <const C extends Config>(config: BuildConfig<C>) => {
  const hasApiKeyCollection = (config.collections || []).some((c) => c.auth?.type === 'apiKey');

  return [
    adminPlugin({
      accessControl,
      roles: {
        admin,
        user,
        staff
      }
    }),
    apiKey({
      defaultKeyLength: 48,
      enableMetadata: true,
      // A key is verified on every API request it makes: no daily quota
      rateLimit: { enabled: false },
      permissions: {
        defaultPermissions: {
          // The roles of a key made through better-auth's own `/api-key/create` route. rime's keys
          // carry their document's roles (create-better-auth-user.server.ts). 'none' matches no
          // access rule; it applies when no collection uses api-key auth.
          roles: hasApiKeyCollection ? ['user'] : ['none']
        }
      }
    })
  ];
};
