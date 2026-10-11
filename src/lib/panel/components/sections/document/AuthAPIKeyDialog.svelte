<script lang="ts">
  import { dev } from '$app/env';
  import * as Dialog from '#lib/panel/components/ui/dialog/index.js';
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';

  type Props = { apiKey: string | null };

  let { apiKey = $bindable() }: Props = $props();
  let dialogOpen = $derived(!!apiKey);
  let copied = $state(false);

  function copyAPIKey() {
    if (!apiKey) return;

    // Over plain http, in dev, the browser gives no clipboard: the key reads as copied so the
    // flow can be tried. In production, over https, the copy below runs.
    if (dev && !navigator.clipboard) {
      copied = true;
      return;
    }

    if (!navigator.clipboard) return;

    navigator.clipboard
      .writeText(apiKey)
      .then(() => {
        copied = true;
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
      });
  }
</script>

<!-- Closed any way, Escape included, the key is cleared: the form then redirects -->
<Dialog.Root
  open={dialogOpen}
  onOpenChange={(open) => {
    if (!open) apiKey = null;
  }}
>
  <Dialog.Content size="lg">
    <Dialog.Header>{t__('common.api_key_dialog_title')}</Dialog.Header>
    <p>{t__('common.api_key_dialog_text')}</p>
    <p class="rz-dialog-api__key">
      {apiKey}
      <Button
        size="icon-sm"
        variant="ghost"
        class="rz-dialog-api__copy {copied ? 'rz-dialog-api--copied' : ''}"
        onclick={copyAPIKey}
        icon={copied ? Check : Copy}
      />
    </p>
    <Dialog.Footer>
      <Button onclick={() => (apiKey = null)}>{t__('common.close')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  .rz-dialog-api__key {
    position: relative;
    @mixin well;
    min-height: var(--rz-input-height);
    align-items: center;
    display: flex;
    padding: var(--rz-size-2) var(--rz-size-16) var(--rz-size-2) var(--rz-size-2);
    border-radius: var(--rz-radius-md);
    word-break: break-all;
    :global {
      .rz-dialog-api__copy {
        position: absolute;
        right: var(--rz-size-1);
      }
      .rz-dialog-api--copied {
        color: var(--rz-success);
      }
    }
  }
</style>
