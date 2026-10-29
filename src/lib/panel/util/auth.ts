import { SITE_URL } from '$app/env/public';
import { createAuthClient } from 'better-auth/svelte';

/**
 * better-auth's browser client on `SITE_URL`: the panel signs out and asks for password resets
 * with it.
 */
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: SITE_URL
});
