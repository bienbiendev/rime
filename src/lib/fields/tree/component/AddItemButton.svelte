<script lang="ts">
  import type { FieldBuilder } from '$lib/core/fields/builders';
  import { emptyValuesFromFieldConfig, isFormField } from '$lib/core/fields/util';
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
    const empty = emptyValuesFromFieldConfig(fields.map((f) => f.raw).filter(isFormField));
    addItem(empty);
  };
</script>

<Button
  icon={Plus}
  class="rz-add-item-button {className}"
  onclick={() => add()}
  variant="outline"
  {size}
>
  <span>
    {@render children()}
  </span>
</Button>

<style type="postcss">
  :global {
    .rz-add-item-button {
      gap: var(--rz-size-2);
    }
  }
</style>
