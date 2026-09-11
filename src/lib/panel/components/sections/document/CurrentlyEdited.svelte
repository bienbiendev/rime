<script lang="ts">
  import { PARAMS } from '$lib/core/constants.js';
  import { apiUrl } from '$lib/core/routes/util.js';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { Button } from '../../ui/button/index.js';

  type Props = { id?: string | null; takeControl: () => void };
  const { id, takeControl }: Props = $props();

  const APIProxy = getAPIProxyContext();

  // Resolved here rather than joined onto every read. The proxy caches by url, so the same
  // holder asked for twice costs one request.
  const holder = $derived(
    id
      ? APIProxy.getRessource<{ doc: { name?: string; email?: string } }>(
          `${apiUrl('staff', id)}?${PARAMS.SELECT}=name,email`
        )
      : null
  );

  const label = $derived(holder?.data?.doc.email ?? holder?.data?.doc.name ?? 'Someone');
</script>

<div class="rz-document-read-only">
  <p>{label} is editing the document</p>
  <Button variant="outline" onclick={takeControl}>Take control</Button>
</div>

<style lang="postcss">
  .rz-document-read-only {
    display: grid;
    gap: 1rem;
    place-content: center;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: light-dark(hsl(var(--rz-gray-12) / 0.8), hsl(var(--rz-gray-3) / 0.8));
    backdrop-filter: blur(2px);
  }
</style>
