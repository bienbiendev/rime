import { SITE_URL } from '$app/env/public';
import { createAuthClient } from 'better-auth/svelte';

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: SITE_URL
});
