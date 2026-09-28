<script lang="ts">
  import { page } from '$app/state';
  import type { ResolvedPathname } from '$app/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { panelPath } from '$lib/core/routes/util.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import type { BuiltCollection } from '$lib/types';
  import { Plus } from '@lucide/svelte';

  type Props = {
    config: BuiltCollection;
    /** `sm`: an icon alone. `default`: an icon and the label. */
    size?: 'sm' | 'default';
    /** The labelled button's look; `default` is the primary one. */
    variant?: 'default' | 'secondary' | 'ghost';
  };
  const { config, size = 'default', variant = 'default' }: Props = $props();

  const buttonLabel = $derived(
    config.label.create || t__(`common.create_new`, config.label.singular)
  );

  const createPathname = $derived.by(() => {
    const path = panelPath(config.kebab, 'create');
    if (config.upload) {
      const currentUploadPath = page.url.searchParams.get(PARAMS.UPLOAD_PATH);
      return `${path}?${PARAMS.UPLOAD_PATH}=${currentUploadPath || 'root'}` as ResolvedPathname;
    }
    return path;
  });
</script>

{#if size === 'sm'}
  <Button
    variant="ghost"
    size="icon-sm"
    class="rz-button-create--icon"
    href={createPathname}
    aria-label={buttonLabel}
    title={buttonLabel}
  >
    <Plus size={15} />
  </Button>
{:else}
  <Button {variant} size="sm" icon={Plus} href={createPathname}>
    {buttonLabel}
  </Button>
{/if}

<style type="postcss">
  /* A plain plus, subtle until hovered. */
  :global(.rz-button.rz-button-create--icon) {
    width: var(--rz-size-7);
    height: var(--rz-size-7);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg-subtle);

    &:hover {
      color: var(--rz-fg);
    }
  }
</style>
