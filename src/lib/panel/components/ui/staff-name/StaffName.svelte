<script lang="ts">
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { apiUrl } from '$lib/util/index.js';

  /**
   * The name behind a user id.
   *
   * `createdBy`, `updatedBy` and the edit lock all store a staff id — a `._root()` relation has
   * no junction table to hold anything richer — so resolving one to something a person can read is
   * the panel's job, and it happens here rather than in each of the three places that show one.
   *
   * Through the API proxy, which caches by URL: a list of fifty documents edited by the same two
   * people makes two requests, not fifty. `select=title` because that is all that is drawn, and on
   * a staff collection `asTitle` is the email.
   */
  type Props = { id: string | null | undefined; fallback?: string };
  const { id, fallback = '—' }: Props = $props();

  const APIProxy = getAPIProxyContext();

  const resource = $derived(
    id ? APIProxy.getRessource<{ doc: GenericDoc }>(`${apiUrl('staff', id)}?select=title`) : null
  );
</script>

<span class="rz-staff-name">{resource?.data?.doc?.title || fallback}</span>

<style lang="postcss">
  .rz-staff-name {
    @mixin line-clamp 1;
  }
</style>
