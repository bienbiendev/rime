<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte';
  import DropZone from './DropZone.svelte';

  type Props = { open: boolean; collection: CollectionContext };
  let { open = $bindable(), collection }: Props = $props();

  let btnLabel = $state('Cancel');
  let btnDisabled = $state(true);

  function onFinish(hasErrors: boolean) {
    btnDisabled = false;
    btnLabel = 'Close';
    if (!hasErrors) {
      open = false;
    }
    invalidateAll();
  }

  function onStart() {
    btnDisabled = true;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content size="lg" class="rz-status-dialog">
    <Dialog.Header>{t__('common.bulk_upload_dialog_title')}</Dialog.Header>
    <DropZone {collection} {onFinish} {onStart} />
    <Dialog.Footer --rz-justify-content="space-between">
      <Button disabled={!btnDisabled} variant="secondary" onclick={() => (open = false)}
        >{btnLabel}</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
