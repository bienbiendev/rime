<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import type { Dic } from '$lib/util/types.js';
  import { watch } from 'runed';
  import Sortable from 'sortablejs';
  import { onDestroy } from 'svelte';
  import AddItemButton from './AddItemButton.svelte';
  import type { TreeProps } from './props.js';
  import TreeBlock from './TreeBlock.svelte';

  const { path, config, form }: TreeProps = $props();

  const locale = getLocaleContext();

  const treeState = $derived(form.useTree(path));
  const field = $derived(form.useField(path, config));
  let sortingInitialized = $state(false);
  let fieldElement = $state<HTMLFieldSetElement>();
  let sorting = $state(false);
  let sortableInstances = $state<ReturnType<typeof Sortable.create>[]>([]);

  const hasBlocks = $derived(treeState.items && treeState.items.length);
  const key = $state(new Date().getTime().toString());
  const nested = $derived(path.split('.').length > 1);
  const shouldInit = $derived(!sortingInitialized && treeState.items.length > 0);

  /**
   * A card drags by its header, and shows only its header while it moves; where it lands is a
   * line. Dropped in an open card's _Inside_ zone, it goes inside that item.
   */
  const sortableOptions: Sortable.Options = {
    handle: '.rz-tree-item__grip',
    draggable: '.rz-tree-item',
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: 'rz-tree-item--floating',
    ghostClass: 'rz-tree-item--landing',
    swapThreshold: 0.65,
    // An empty zone has little height: a drop this close lands in it.
    emptyInsertThreshold: 12,
    group: {
      name: `list-${key}`,
      put: (to, _, el) => {
        if (!el.classList.contains('rz-tree-item')) return false;
        const targetDepth = parseInt(to.el.dataset.treeDepth || '0');
        const childrenCount = parseInt(el.dataset.treeChildren || '0');
        return targetDepth + childrenCount <= config.get.maxDepth;
      }
    },
    onStart: () => {
      sorting = true;
      holdHeight(true);
    },
    onUnchoose: () => {
      sorting = false;
      holdHeight(false);
    },
    onEnd: function (evt) {
      const { newIndex, to } = evt;

      const initialPath = evt.item.dataset.path;
      const targetListPath = to.dataset.path;
      const isTargetPathRoot = targetListPath === path;
      const targetPath = `${targetListPath}${!isTargetPathRoot ? '._children' : ''}.${newIndex}`;

      if (initialPath !== undefined && initialPath !== targetPath) {
        treeState.moveItem(initialPath.replace(`${path}.`, ''), targetPath.replace(`${path}.`, ''));
        resetSortable();
      }

      sorting = false;
    }
  };

  /**
   * While a card moves, the field keeps its height: a card leaving the bottom of the page would
   * scroll it, and the zone under the pointer with it.
   */
  function holdHeight(hold: boolean) {
    if (!fieldElement) return;
    fieldElement.style.minHeight = hold ? `${fieldElement.offsetHeight}px` : '';
  }

  const resetSortable = () => {
    destroySortable();
    sortingInitialized = false;
  };

  const destroySortable = () => {
    sortableInstances.forEach((instance) => instance.destroy());
    sortableInstances = [];
  };

  const add = (emptyValues: Dic) => {
    treeState.addItem(emptyValues);
    resetSortable();
  };

  watch(() => treeState.stamp, resetSortable);

  $effect(() => {
    if (shouldInit) {
      const lists = document.querySelectorAll(`.rz-tree__list[data-tree-key="${key}"]`);
      for (const [index, list] of lists.entries()) {
        sortableInstances[index] = Sortable.create(list as HTMLElement, sortableOptions);
      }
      sortingInitialized = true;
    }
  });

  onDestroy(() => {
    destroySortable();
  });
</script>

<fieldset
  class="rz-field-tree {config.get.className}"
  bind:this={fieldElement}
  use:fieldset={field}
>
  <Field.Error error={field.error} />

  <Field.Label {config} />
  <Field.Hint {config} />
  {#key treeState.stamp}
    <div
      class="rz-tree__list rz-tree__list--root"
      data-tree-key={key}
      data-tree-depth="0"
      data-path={path}
      data-empty={!hasBlocks ? '' : null}
    >
      {#if hasBlocks}
        {#each treeState.items as item, index (item.id)}
          <TreeBlock {treeState} treeKey={key} path="{path}.{index}" {form} {sorting} {config} />
        {/each}
      {/if}
    </div>
  {/key}

  <div class="rz-tree__actions">
    <AddItemButton
      addItem={add}
      class="rz-tree__add-button"
      size={nested ? 'sm' : 'default'}
      fields={config.get.fields}
    >
      {config.get.addItemLabel}
    </AddItemButton>

    {#if locale && locale.code !== locale.defaultCode && config.get.localized}
      <Button size="sm" onclick={field.setValueFromDefaultLocale} variant="secondary">
        {t__('fields.get_data_from')}
        {locale.defaultCode}
      </Button>
    {/if}
  </div>
</fieldset>

<style lang="postcss">
  /* The items of the first level: one card each. */
  .rz-tree__list--root {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-2);
  }

  /* Under the cards: the add button, the locale import. */
  .rz-tree__actions {
    display: flex;
    align-items: center;
    gap: var(--rz-size-3);
    margin-top: var(--rz-size-2-5);
    margin-left: --size(-0.5);
  }

  .rz-tree__list--root[data-empty] + .rz-tree__actions {
    margin-top: 0;
  }
</style>
