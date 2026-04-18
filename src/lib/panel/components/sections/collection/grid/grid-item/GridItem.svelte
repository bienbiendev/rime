<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { isUploadConfig } from '$lib/core/collections/upload/util/config';
  import { PARAMS, UPLOAD_PATH } from '$lib/core/constant.js';
  import type { GenericDoc } from '$lib/core/types/doc';
  import CardDocument from '$lib/panel/components/ui/card-document/card-document.svelte';
  import Checkbox from '$lib/panel/components/ui/checkbox/checkbox.svelte';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { panelUrl } from '$lib/panel/util/url.js';

  type Props = { checked: boolean; doc: GenericDoc; draggable?: 'true' };
  const { checked, doc, draggable }: Props = $props();

  const collection = getCollectionContext('list');

  const isUploadCollection = $derived(isUploadConfig(collection.config));

  function handleEdit() {
    const uploadPath = isUploadCollection
      ? page.url.searchParams.get(PARAMS.UPLOAD_PATH) || UPLOAD_PATH.ROOT_NAME
      : null;
    const params = uploadPath ? `?${PARAMS.UPLOAD_PATH}=${uploadPath}` : '';
    goto(`${panelUrl(collection.config.kebab, doc.id)}${params}`);
  }

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', doc.id);
  }
</script>

{#if collection.selectMode}
  <div class="rz-grid-item">
    <button
      onclick={() => collection.toggleSelectOf(doc.id)}
      type="button"
      aria-label="select"
      class="rz-grid-item__select-button"
    >
      <Checkbox {checked} />
    </button>
    <CardDocument {doc} />
  </div>
{:else}
  <button
    class="rz-grid-item"
    onclick={handleEdit}
    draggable={draggable || null}
    ondragstart={draggable ? handleDragStart : null}
  >
    <CardDocument {doc} />
  </button>
{/if}

<style lang="postcss">
  button.rz-grid-item {
    text-align: left;
  }
  .rz-grid-item {
    --checkbox-border: hsl(var(--rz-gray-10));
    --rz-card-color-bg: var(--rz-gray-10);
    display: block;
    position: relative;
  }

  .rz-grid-item__select-button {
    position: absolute;
    left: var(--rz-size-2);
    top: var(--rz-size-2);
  }
</style>
