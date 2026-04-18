import { env } from '$env/dynamic/public';
import { apiKeyClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte';

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: env.PUBLIC_RIME_URL,
  plugins: [apiKeyClient()]
});
