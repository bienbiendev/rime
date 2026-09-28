<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import type { UploadProgress } from '$lib/panel/util/upload-file.js';

  type Props = { progress: UploadProgress; class?: string };
  const { progress, class: className }: Props = $props();
</script>

<!-- The file on its way, how many are up, and the ones that did not make it. -->
<div class="rz-bulk-infos {className ?? ''}" aria-live="polite">
  {#if progress.current}
    <p class="rz-bulk-infos__current">
      <SpinLoader />
      <span>{progress.current}</span>
    </p>
  {/if}
  <p class="rz-bulk-infos__processed">
    {t__('fields.upload_progress', String(progress.uploaded), String(progress.total))}
  </p>
  {#if progress.failed.length}
    <p class="rz-bulk-infos__errors">
      {t__('fields.upload_failed', progress.failed.join(', '))}
    </p>
  {/if}
</div>

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-bulk-infos {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--rz-size-2);
    min-width: 0;
    color: var(--rz-fg-muted);
  }

  .rz-bulk-infos__current {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .rz-bulk-infos__processed {
    @mixin font-medium;
    color: var(--rz-fg);
    font-variant-numeric: tabular-nums;
  }

  .rz-bulk-infos__errors {
    color: var(--rz-danger);
    font-size: var(--rz-text-sm);
  }
</style>
