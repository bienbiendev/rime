import { SITE_URL } from '$app/env/public';
import { t__ } from '#lib/core/i18n/index.js';
import { trycatch } from '#lib/util/function.js';
import { createAuthClient } from 'better-auth/svelte';
import { toast } from 'svelte-sonner';

/**
 * better-auth's browser client on `SITE_URL`: the panel signs out and asks for password resets
 * with it.
 */
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: SITE_URL
});

/**
 * Sends one better-auth request and answers its data, or `null` once an error toast says what
 * went wrong in the panel's language. A request that fails on the network answers `null` too.
 *
 * ```ts
 * const answer = await authRequest(() => authClient.requestPasswordReset({ email, redirectTo }));
 * ```
 */
export const authRequest = async <T>(
  send: () => Promise<{ data: T | null; error: { code?: string } | null }>
): Promise<T | null> => {
  const [failure, answer] = await trycatch(send);
  if (failure || answer.error) {
    // An expired or reused reset link is the one failure a reader can act on
    const invalidLink = answer?.error?.code === 'INVALID_TOKEN';
    toast.error(invalidLink ? t__('common.reset_link_invalid') : t__('common.generic_error'));
    return null;
  }
  return answer.data;
};
