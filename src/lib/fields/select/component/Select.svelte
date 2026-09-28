<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import Tag from '$lib/panel/components/ui/tag/tag.svelte';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { moveItem } from '$lib/util/array';
  import type { SelectFieldProps } from './props.js';

  const { path, config, form }: SelectFieldProps = $props();

  let listHTMLElement = $state<HTMLElement>();
  let initialized = false;
  let options = $derived(config.get.options);
  const validValues = $derived(config.get.options.map((o) => o.value));
  const field = $derived(form.useField<string | string[]>(path, config));

  let isFull = $derived.by(() => {
    if (!field.value) return false;
    const notManyAndOneSelected = !config.get.many && typeof field.value === 'string';
    const manyAndAllSelected = config.get.many && field.value.length === config.get.options.length;
    return notManyAndOneSelected || manyAndAllSelected;
  });

  let search = $state('');
  let inputFocused = $state(false);

  const { sortable } = useSortable({
    animation: 150,
    draggable: '.rz-select__option',
    onEnd: function (e) {
      if (e.oldIndex !== undefined && e.newIndex !== undefined) {
        onOrderChange(e.oldIndex, e.newIndex);
      }
    }
  });

  /** The picked options reorder by drag; the instance goes with the list. */
  $effect(() => {
    if (!config.get.many || !listHTMLElement) return;
    const instance = sortable(listHTMLElement);
    return () => instance.destroy();
  });

  $effect(() => {
    if (config.get.many) {
      if (field.value && Array.isArray(field.value) && !initialized) {
        field.value = field.value.filter((val: string) => validValues.includes(val));
      }
    } else if (typeof field.value === 'string') {
      if (field.value && !initialized) {
        field.value = validValues.includes(field.value) ? field.value : null;
      }
    }
    initialized = true;
  });

  $effect(() => {
    if (config.get.many) {
      const currentValue = $state.snapshot(field.value);
      if (!currentValue) {
        options = config.get.options;
      } else {
        options = config.get.options.filter((option) => !currentValue.includes(option.value));
      }
    }
  });

  const onOrderChange = (oldIndex: number, newIndex: number) => {
    if (!Array.isArray(field.value)) return;
    field.value = moveItem(field.value, oldIndex, newIndex);
  };

  const addValue = (val: string) => {
    if (isFull) return;
    if (config.get.many) {
      field.value = [...(field.value || []), val];
    } else {
      field.value = val;
    }
  };

  const removeValue = (val?: string) => {
    if (config.get.many) {
      field.value = [...(field.value || [])].filter((v) => v !== val);
    } else {
      field.value = null;
    }
  };
</script>

<fieldset class="rz-field-select {config.get.className || ''}" use:fieldset={field}>
  <Field.Label for={path || config.name} {config} />
  <Field.Error error={field.error} />

  <div class="rz-select">
    <Command.Root>
      <div
        bind:this={listHTMLElement}
        class="rz-select__list"
        class:rz-select__list--readonly={form.readOnly}
        data-focused={inputFocused ? '' : null}
        data-error={field.error ? '' : null}
      >
        {#if config.get.many}
          {#each field.value || [] as val (val)}
            {@const option = config.get.options.find((o) => o.value === val)}
            {#if option}
              <div class="rz-select__option">
                <Tag onRemove={() => removeValue(option.value)} readOnly={form.readOnly}>
                  {option.label}
                </Tag>
              </div>
            {/if}
          {/each}
        {:else if field.value}
          {@const option = config.get.options.filter((o) => o.value === field.value)[0]}
          {#if option}
            <Tag onRemove={() => removeValue()} readOnly={form.readOnly}>
              {option.label}
            </Tag>
          {/if}
        {/if}

        {#if !form.readOnly && !isFull}
          <Command.InputSelect
            name={path || config.name}
            autocomplete="off"
            onfocus={() => (inputFocused = true)}
            onblur={() => setTimeout(() => (inputFocused = false), 200)}
            bind:value={search}
            placeholder={t__('common.search')}
          />
          {#if inputFocused}
            <Command.List>
              {#each options as option, index (index)}
                <Command.Item
                  value={option.value}
                  onSelect={() => {
                    addValue(option.value);
                    search = '';
                  }}
                >
                  <span>{option.label}</span>
                </Command.Item>
              {/each}
              <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
            </Command.List>
          {/if}
        {/if}
      </div>
    </Command.Root>
  </div>
  <Field.Hint {config} />
</fieldset>

<style type="postcss">
  @import '../../../panel/style/mixins/index.css';

  .rz-select {
    position: relative;

    :global(.rz-command) {
      width: 100%;
      border-radius: var(--rz-radius-lg);
    }

    :global(.rz-command-input-select) {
      min-width: var(--rz-size-24);
      padding-inline: var(--rz-size-2);
      cursor: text;
    }

    :global(.rz-command-list) {
      @mixin surface float;
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + var(--rz-size-1-5));
      z-index: 20;
      border-radius: var(--rz-radius-xl);
    }

    :global(.rz-command-item) {
      min-height: var(--rz-size-7);
      border-radius: var(--rz-radius-md);
      font-size: var(--rz-text-md);
    }

    :global(.rz-command-item[aria-selected='true']) {
      background-color: var(--rz-bg-hover);
    }

    /* Nothing matches: one quiet line. */
    :global(.rz-command-empty) {
      padding: var(--rz-size-2) var(--rz-size-2-5);
      color: var(--rz-fg-subtle);
      font-size: var(--rz-text-sm);
    }
  }

  /* One well: the picked options, then the search. */
  .rz-select__list {
    @mixin well;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--rz-size-1);
    min-height: var(--rz-input-height);
    padding: var(--rz-size-1);
    border-radius: var(--rz-radius-lg);
  }

  .rz-select__list[data-focused] {
    @mixin focus-field;
  }

  .rz-select__list[data-error] {
    @mixin invalid-field;
  }

  .rz-select__list--readonly {
    cursor: no-drop;
  }
</style>
