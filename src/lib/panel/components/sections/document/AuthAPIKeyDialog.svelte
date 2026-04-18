<script lang="ts">
  import { dev } from '$app/environment';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { Check, Copy } from '@lucide/svelte';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';

  type Props = { apiKey: string | null };

  let { apiKey = $bindable() }: Props = $props();
  let dialogOpen = $derived(!!apiKey);
  let copied = $state(false);

  function copyAPIKey() {
    if (!apiKey) return false;

    if (dev && !navigator.clipboard) {
      copied = true;
      return true;
    }

    if (!navigator.clipboard) return false;

    navigator.clipboard
      .writeText(apiKey)
      .then(() => {
        copied = true;
        return true;
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
        return false;
      });
  }
</script>

<Dialog.Root open={dialogOpen}>
  <Dialog.Trigger />
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
    <Dialog.Footer --rz-justify-content="space-between">
      <Button onclick={() => (apiKey = null)}>{t__('common.close')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  .rz-dialog-api__key {
    --rz-button-ghost-bg-hover: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-5)));
    position: relative;
    border: var(--rz-border);
    background-color: hsl(var(--rz-input-bg));
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
        color: hsl(var(--rz-color-success));
      }
    }
  }
</style>
