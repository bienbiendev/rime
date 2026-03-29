import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { MailerActions } from '$lib/core/plugins/mailer/index.server.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Config } from '$lib/types.js';
import { admin as adminPlugin, apiKey } from 'better-auth/plugins';
import type { BuildConfig } from '../server/index.server.js';
import { betterAuthAfterHook, betterAuthBeforeHook } from './better-auth-hooks.js';
import { accessControl, admin, staff, user } from './better-auth-permissions.js';

export function getBaseAuthConfig<const C extends Config>(ctx: {
	mailer: MailerActions | undefined;
	config: ConfigContext<C>;
}) {
	const betterAuthOptions = {
		baseURL: env.PUBLIC_RIME_URL,
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
			changeEmail: {
				enabled: true
			},
			deleteUser: {
				enabled: true
			},
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
	const HAS_API_KEY = (config.collections || []).filter((c) => c.auth?.type === 'apiKey').length;

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
			permissions: {
				defaultPermissions: {
					roles: HAS_API_KEY ? ['user'] : ['none']
				}
			}
		})
	];
};
