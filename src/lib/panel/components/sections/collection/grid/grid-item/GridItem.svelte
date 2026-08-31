<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { isUploadConfig } from '$lib/core/features/upload/util/config';
  import { PARAMS, UPLOAD_PATH } from '$lib/core/constants.js';
  import type { GenericDoc } from '$lib/core/types/doc';
  import CardDocument from '$lib/panel/components/ui/card-document/card-document.svelte';
  import Checkbox from '$lib/panel/components/ui/checkbox/checkbox.svelte';
  import { panelUrl } from '$lib/panel/util/url.js';
  import type { BuiltCollection } from '$lib/types';

  type Props = {
    checked: boolean;
    doc: GenericDoc;
    draggable?: 'true';
    isSelectMode?: boolean;
    config: BuiltCollection;
    toggleSelectOf?: (id: string) => void;
  };

  const { checked, doc, draggable, isSelectMode, config, toggleSelectOf }: Props = $props();

  const isUploadCollection = $derived(isUploadConfig(config));

  function handleEdit() {
    const uploadPath = isUploadCollection
      ? page.url.searchParams.get(PARAMS.UPLOAD_PATH) || UPLOAD_PATH.ROOT_NAME
      : null;
    const params = uploadPath ? `?${PARAMS.UPLOAD_PATH}=${uploadPath}` : '';
    goto(`${panelUrl(config.kebab, doc.id)}${params}`);
  }

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', doc.id);
  }

  function handleClick() {
    if (isSelectMode) {
      toggleSelectOf?.(doc.id);
    } else {
      handleEdit();
    }
  }
</script>

<button
  class="rz-grid-item"
  onclick={handleClick}
  draggable={draggable || null}
  ondragstart={draggable ? handleDragStart : null}
>
  {#if isSelectMode}
    <Checkbox {checked} />
  {/if}
  <CardDocument {doc} />
</button>

<style lang="postcss">
  button.rz-grid-item {
    text-align: left;
  }
  .rz-grid-item {
    --checkbox-border: hsl(var(--rz-gray-10));
    --rz-card-color-bg: var(--rz-gray-10);
    display: block;
    position: relative;

    :global {
      .rz-checkbox {
        background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-0)));
        border: var(--rz-border);
        pointer-events: none;
        position: absolute;
        left: var(--rz-size-2);
        top: var(--rz-size-2);
      }
    }
  }
</style>
