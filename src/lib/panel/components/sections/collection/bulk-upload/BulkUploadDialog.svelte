<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import type { UploadTarget } from '$lib/panel/util/upload-file.js';
  import { X } from '@lucide/svelte';
  import DropZone from './DropZone.svelte';

  type Props = {
    open: boolean;
    /** Where the files go: the collection's API, the folder, the types it takes. */
    target: UploadTarget;
  };
  let { open = $bindable(), target }: Props = $props();

  /** While files go up, the dialog stays open. */
  let busy = $state(false);

  function onStart() {
    busy = true;
  }

  /** Closes on success; on an error, stays open on the report. */
  function onFinish(hasErrors: boolean) {
    busy = false;
    if (!hasErrors) open = false;
    invalidateAll();
  }

  const stay = $derived(busy ? 'ignore' : 'close');
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    size="lg"
    class="rz-bulk-upload"
    escapeKeydownBehavior={stay}
    interactOutsideBehavior={stay}
  >
    <header class="rz-bulk-upload__head">
      <Dialog.Title level={3}>{t__('fields.upload')}</Dialog.Title>
      <Button
        variant="ghost"
        size="icon-sm"
        icon={X}
        disabled={busy}
        aria-label={t__('common.close')}
        onclick={() => (open = false)}
      />
    </header>
    <div class="rz-bulk-upload__body">
      <DropZone {target} {onFinish} {onStart} />
    </div>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  :global(.rz-dialog-content.rz-bulk-upload) {
    gap: 0;
    padding: 0;
    overflow: hidden;
    border-radius: var(--rz-radius-xl);
  }

  .rz-bulk-upload__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-3);
    height: var(--rz-size-12);
    padding: 0 var(--rz-size-2-5) 0 var(--rz-size-4);

    :global(.rz-dialog-title) {
      margin: 0;
      font-size: var(--rz-text-lg);
    }
  }

  .rz-bulk-upload__body {
    padding: 0 var(--rz-size-4) var(--rz-size-4);
  }
</style>
