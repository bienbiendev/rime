<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { panelPath } from '$lib/core/routes/util.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import type { BuiltCollection } from '$lib/types';
  import { CirclePlus } from '@lucide/svelte';

  type ButtonSize = 'sm' | 'default';
  const { config, size = 'default' }: { config: BuiltCollection; size?: ButtonSize } = $props();

  const isSmallSize = $derived(size === 'sm');
  const buttonVariant = $derived(isSmallSize ? 'ghost' : 'default');
  const buttonSize = $derived(isSmallSize ? 'icon-sm' : 'default');
  const buttonLabel = $derived(
    config.label.create || t__(`common.create_new`, config.label.singular)
  );

  const createPathname = $derived.by(() => {
    const currentUploadPath = page.url.searchParams.get(PARAMS.UPLOAD_PATH);
    if (config.upload) {
      return resolve(
        `${panelPath(config.kebab)}/create?${PARAMS.UPLOAD_PATH}=${currentUploadPath || 'root'}`
      );
    }
    return resolve(`${panelPath(config.kebab)}/create`);
  });
</script>

<Button variant={buttonVariant} size={buttonSize} href={createPathname}>
  {#if isSmallSize}
    <CirclePlus size={16} />
  {:else}
    {buttonLabel}
  {/if}
</Button>
