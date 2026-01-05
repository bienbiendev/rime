import { dev } from '$app/environment';
import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeFormError } from '$lib/core/errors/index.js';
import { redirect, type Actions } from '@sveltejs/kit';

export const signInActions: Actions = {
	default: async ({ cookies, request, locals }) => {
		const { rime } = locals;

		const data = await request.formData();
		const email = data.get('email')?.toString() || '';
		const password = data.get('password')?.toString() || '';

		const response = await rime.auth.api.signInEmail({
			body: { email, password },
			asResponse: true
		});

		const authenticated = response && response.status === 200;

		if (!authenticated) {
			return handleError(
				new RimeFormError({
					_form: RimeFormError.INVALID_CREDENTIALS,
					email: RimeFormError.INVALID_CREDENTIALS,
					password: RimeFormError.INVALID_CREDENTIALS
				}),
				{
					context: 'action',
					formData: { email }
				}
			);
		}

		const setCookieHeader = response.headers.get('set-cookie') as string;

		if (setCookieHeader) {
			const parsedCookie = setCookieHeader.split(';')[0];
			const [name, encodedValue] = parsedCookie.split('=');
			const decodedValue = decodeURIComponent(encodedValue);

			cookies.set(name, decodedValue, {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				maxAge: 604800,
				secure: !dev
			});
		}

		throw redirect(302, '/panel');
	}
};
