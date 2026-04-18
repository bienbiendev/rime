<script lang="ts">
  import { page } from '$app/state';
  import { PARAMS } from '$lib/core/constant.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { CirclePlus } from '@lucide/svelte';

  type ButtonSize = 'sm' | 'default';
  const { size = 'default' }: { size?: ButtonSize } = $props();

  const collection = getCollectionContext('list');
  const isSmallSize = $derived(size === 'sm');
  const buttonVariant = $derived(isSmallSize ? 'ghost' : 'default');
  const buttonSize = $derived(isSmallSize ? 'icon-sm' : 'default');
  const buttonLabel = $derived(
    collection.config.label.create || t__(`common.create_new`, collection.config.label.singular)
  );

  const createURL = $derived.by(() => {
    const currentUploadPath = page.url.searchParams.get(PARAMS.UPLOAD_PATH);
    if (collection.config.upload) {
      return `${collection.panelUrl}/create?${PARAMS.UPLOAD_PATH}=${currentUploadPath || 'root'}`;
    }
    return `${collection.panelUrl}/create`;
  });
</script>

{#if collection.canCreate}
  <Button variant={buttonVariant} size={buttonSize} href={createURL}>
    {#if isSmallSize}
      <CirclePlus size={16} />
    {:else}
      {buttonLabel}
    {/if}
  </Button>
{/if}
