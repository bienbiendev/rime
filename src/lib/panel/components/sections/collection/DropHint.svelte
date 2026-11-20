<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import Upload from '@lucide/svelte/icons/upload';

  type Props = {
    /** `tile`: a grid cell, as tall as a thumbnail. `row`: a strip under the list. */
    shape: 'tile' | 'row';
  };
  const { shape }: Props = $props();
</script>

<!-- A dashed box that says a file dropped on the page is uploaded. -->
<div class="rz-drop-hint rz-drop-hint--{shape}">
  <Upload size={15} />
  <span>{t__('common.drop_anywhere')}</span>
</div>

<style lang="postcss">
  .rz-drop-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--rz-size-2);
    padding-inline: var(--rz-size-3);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    text-align: center;
  }

  .rz-drop-hint--tile {
    flex-direction: column;
    align-self: start;
    aspect-ratio: 4 / 3;
  }

  .rz-drop-hint--row {
    height: var(--rz-row-height);
  }
</style>
