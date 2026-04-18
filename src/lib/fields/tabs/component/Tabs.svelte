<script lang="ts">
  import RichText from '$lib/fields/rich-text/component/RichText.svelte';
  import { RichTextFieldBuilder } from '$lib/fields/rich-text/index.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import * as Tabs from '$lib/panel/components/ui/tabs/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import type { TabBuilder, TabsField } from '../index.js';

  type Props = { config: TabsField; path: string; form: DocumentFormContext };

  const { config, path: initialPath, form }: Props = $props();

  const storageActiveKey = $derived(`rime.Tabs:${form.values.id || 'create'}:${initialPath}`);
  let errorTabs = $state<string[]>([]);
  // Path to prepend to fields inside tabs
  const prependPath = $derived(initialPath === '' ? '' : `${initialPath}.`);
  // Generate unique IDs for each tab to use as data attributes for error handling.
  const tabIds = $derived(
    config.tabs.map((tab) => `${tab.name}-${new Date().getTime().toString()}`)
  );

  // Retrieve active tab from localStorage, if not found use the first tab.
  // If the stored active tab is not available in live mode, fallback to the first tab.
  let activeTabName = $derived.by(() => {
    let storedActiveTab = localStorage.getItem(storageActiveKey);
    if (storedActiveTab && form.isLive) {
      const activeTab = config.tabs.find((tab) => tab.name === storedActiveTab);
      if (!activeTab || activeTab.raw.live === false) {
        return config.tabs[0].name;
      }
    }
    return storedActiveTab || config.tabs[0].name;
  });

  // On live mode only show tabs with live=true
  function isTabVisible(tab: TabBuilder) {
    return form.isLive ? tab.raw.live === true : true;
  }

  function onActiveTabChange(value: string): void {
    localStorage.setItem(storageActiveKey, value);
    activeTabName = value;
  }

  // Emphasize tabs that includes errors
  $effect(() => {
    if (form.errors.length) {
      const selector = '.rz-tabs-content:has(*[data-error])';
      const errorsTabs = document.querySelectorAll<HTMLElement>(selector);
      if (errorsTabs) {
        errorTabs = Array.from(errorsTabs)
          .map((el) => el.dataset.tabId)
          .filter((str) => typeof str === 'string');
      }
    } else {
      errorTabs = [];
    }
  });
</script>

<div class="rz-tabs">
  <Tabs.Root onValueChange={onActiveTabChange} value={activeTabName}>
    <Tabs.List>
      {#each config.tabs as tab, index (index)}
        {#if isTabVisible(tab)}
          <Tabs.Trigger
            data-error={errorTabs.includes(tabIds[index]) ? 'true' : null}
            value={tab.name}
          >
            {tab.raw.label || tab.name}
          </Tabs.Trigger>
        {/if}
      {/each}
    </Tabs.List>

    {#each config.tabs as tab, index (index)}
      {#if isTabVisible(tab)}
        <Tabs.Content data-tab-id={tabIds[index]} value={tab.name}>
          <!-- If the first and only field is a rich text field, render it directly -->
          {#if tab.fields.length === 1 && tab.raw.fields[0].type === 'richText'}
            {@const firstField = tab.raw.fields[0] as RichTextFieldBuilder}
            <RichText
              standAlone={true}
              path="{prependPath}{tab.name}.{firstField.name}"
              config={firstField.raw}
              {form}
            />
          {:else}
            <!-- Otherwise, render the fields -->
            <RenderFields fields={tab.raw.fields} path="{prependPath}{tab.name}" {form} />
          {/if}
        </Tabs.Content>
      {/if}
    {/each}
  </Tabs.Root>
</div>

<style type="postcss">
  .rz-tabs :global {
    .rz-tabs-content {
      margin-top: var(--rz-size-8);
    }

    .rz-tabs-list {
      padding-left: var(--rz-fields-padding);
      padding-right: var(--rz-fields-padding);
      position: sticky;
      top: var(--rz-tabs-list-top, var(--rz-size-14));
      margin-bottom: 0;
      z-index: 40;
    }
  }
</style>
