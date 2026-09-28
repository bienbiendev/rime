<script lang="ts">
  import type { FieldBuilder } from '$lib/core/fields/builders';
  import { emptyValuesFromFieldConfig } from '$lib/core/fields/util';
  import type { Field } from '$lib/fields/types.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import type { Dic } from '$lib/util/types';
  import { Plus } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  type AddItem = (emptyValues: Dic) => void;
  type Props = {
    size: 'default' | 'sm';
    class: string;
    fields: FieldBuilder<Field>[];
    addItem: AddItem;
    children: Snippet;
  };
  const { class: className, fields, addItem, size, children }: Props = $props();

  const add = () => {
    const empty = emptyValuesFromFieldConfig(fields);
    addItem(empty);
  };
</script>

<Button
  icon={Plus}
  class="rz-add-item-button {className}"
  onclick={() => add()}
  variant="ghost"
  {size}
>
  <span>
    {@render children()}
  </span>
</Button>

<style type="postcss">
  /* A ghost "+ Add": the muted ink, a subtle plus, both darkening on hover. */
  :global {
    .rz-add-item-button.rz-button {
      gap: var(--rz-size-1-5);
      height: var(--rz-size-7);
      padding-inline: var(--rz-size-1-5) var(--rz-size-2);
      color: var(--rz-fg-muted);
    }
    .rz-add-item-button .rz-button__icon {
      width: auto;
      height: auto;
      color: var(--rz-fg-subtle);
    }
    .rz-add-item-button.rz-button:hover:not(:disabled),
    .rz-add-item-button.rz-button:hover:not(:disabled) .rz-button__icon {
      color: var(--rz-fg);
    }
  }
</style>
