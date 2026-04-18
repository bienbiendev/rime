<script lang="ts">
  import { FormFieldBuilder } from '$lib/core/fields/builders';
  import type { FormField } from '$lib/fields/types.js';
  import { capitalize } from '$lib/util/string.js';

  type Props = {
    fields: FormFieldBuilder<FormField>[];
    getField: (field: FormFieldBuilder<FormField>) => { visible: boolean; value: any | null };
  };

  const { fields, getField }: Props = $props();

  //
</script>

<div class="rz-render-fields-preview">
  {#each fields as builder, index (index)}
    {@const field = getField(builder)}
    {#if !builder.raw.hidden && field.visible}
      <div class="rz-render-fields-preview__row" data-visible={field.visible || null}>
        <div class="rz-render-fields-preview__name">
          <p>
            {builder.raw.label || capitalize(builder.name)}
          </p>
        </div>
        <div class="rz-render-fields-preview__value">
          {#if builder.raw.table?.cell}
            {@const ColumnTableCell = builder.raw.table.cell}
            <span><ColumnTableCell value={field.value} /></span>
          {:else if builder.cell}
            {@const Cell = builder.cell}
            <span><Cell value={field.value} /></span>
          {:else}
            <span>{field.value}</span>
          {/if}
        </div>
      </div>
    {/if}
  {/each}
</div>

<style type="postcss">
  .rz-render-fields-preview {
    display: grid;
  }
  .rz-render-fields-preview__row {
    height: var(--rz-input-height);
    align-items: center;
    display: grid;
    grid-template-columns: minmax(var(--rz-size-24), var(--rz-size-32)) 1fr;
    padding-right: 0 var(--rz-size-4);
  }
  .rz-render-fields-preview__row:not(:last-child) {
    border-bottom: var(--rz-border);
  }
  .rz-render-fields-preview__name {
    height: calc(var(--rz-input-height) - 1px);
    background-color: hsl(var(--rz-color-bg));
    padding: 0 var(--rz-size-4);
    border-right: var(--rz-border);
    align-items: center;
    display: flex;
    > p {
      @mixin line-clamp 1;
    }
  }
  .rz-render-fields-preview__value {
    height: var(--rz-input-height);
    padding: 0 var(--rz-size-4);
    align-items: center;
    display: flex;
    span {
      @mixin line-clamp 1;
    }
  }
</style>
