<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import type { ActivePanel } from '$lib/panel/context/livePanel.svelte';
  import { ChevronLeft, Form, Laptop, Save, Smartphone, X } from '@lucide/svelte';
  import Button from '../../ui/button/button.svelte';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';

  type Props = {
    forms: Record<string, DocumentFormContext>;
    onClose: () => void;
    toggleRootPanel: (() => void) | null;
    activePanel: ActivePanel | null;
    currentDevice: 'desktop' | 'mobile';
  };
  let {
    forms,
    onClose,
    toggleRootPanel,
    activePanel,
    currentDevice = $bindable('desktop')
  }: Props = $props();

  const formsWithChanges = $derived(Object.values(forms).filter((form) => form.canSubmit));
  const isProcessing = $derived(Object.values(forms).some((form) => form.processing));

  function saveAll() {
    for (const form of formsWithChanges) {
      try {
        form.element.requestSubmit();
      } catch {
        // form element not yet mounted — skip
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      saveAll();
    }
  }
</script>

<div class="rz-live-floating-ui">
  <Button icon={activePanel ? ChevronLeft : X} onclick={onClose} variant="secondary" size="icon" />

  {#if toggleRootPanel}
    <Button
      onclick={toggleRootPanel}
      variant={activePanel && activePanel.fieldPath === '' ? 'secondary' : 'ghost'}
      size="icon"
      icon={Form}
    />
  {/if}

  <Button
    onclick={() => (currentDevice = 'mobile')}
    variant={currentDevice === 'mobile' ? 'secondary' : 'ghost'}
    size="icon"
    icon={Smartphone}
  />
  <Button
    onclick={() => (currentDevice = 'desktop')}
    variant={currentDevice === 'desktop' ? 'secondary' : 'ghost'}
    size="icon"
    icon={Laptop}
  />

  <Button
    onclick={saveAll}
    disabled={formsWithChanges.length === 0}
    class="rz-live-floating-ui__save"
  >
    {#if isProcessing}
      <SpinLoader />
    {:else}
      <Save size="13" />
    {/if}
    {t__('common.save')}
  </Button>
</div>

<svelte:window onkeydown={handleKeyDown} />

<style>
  .rz-live-floating-ui {
    position: fixed;
    bottom: var(--rz-size-2);
    left: var(--rz-size-2);
    margin-left: var(--rz-size-2);
    margin-right: var(--rz-size-2);
    height: var(--rz-size-14);
    background-color: hsl(var(--rz-color-bg));
    padding: var(--rz-size-2);
    border-radius: var(--rz-radius-md);
    z-index: 1000;
    display: flex;
    gap: var(--rz-size-2);
    box-shadow: var(--rz-shadow-xl);
    border: var(--rz-border);
    :global(.rz-live-floating-ui__save) {
      flex: 1;
    }
  }
</style>
