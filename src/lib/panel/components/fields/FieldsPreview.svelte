<script lang="ts">
  import { FormFieldBuilder } from '$lib/core/fields/builders';
  import type { BaseUseFieldReturn, FieldsPreviewProps, FormField } from '$lib/fields/types.js';
  import type { Component } from 'svelte';

  type Props = {
    fields: FormFieldBuilder<FormField>[];
    getField: (field: FormFieldBuilder<FormField>) => BaseUseFieldReturn;
    preview?: Component<FieldsPreviewProps>;
  };

  const { fields, getField, preview }: Props = $props();
</script>

<div class="rz-render-fields-preview">
  {#if preview}
    {@const Preview = preview}
    <div class="rz-render-fields-preview__custom" data-visible>
      <Preview fields={Object.fromEntries(fields.map((field) => [field.name, getField(field)]))} />
    </div>
  {:else}
    {#each fields as builder, index (index)}
      {@const field = getField(builder)}
      {#if !builder.get.hidden && field.visible}
        <div class="rz-render-fields-preview__row" data-visible={field.visible || null}>
          <div class="rz-render-fields-preview__name">
            <p>
              {builder.get.label}
            </p>
          </div>
          <div class="rz-render-fields-preview__value">
            {#if builder.get.table?.cell}
              {@const ColumnTableCell = builder.get.table.cell}
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
  {/if}
</div>

<style type="postcss">
  @import '../../style/mixins/index.css';

  /* A table: a hairline between name and value, and between rows. */
  .rz-render-fields-preview {
    display: grid;
  }
  .rz-render-fields-preview__row {
    display: grid;
    grid-template-columns: minmax(var(--rz-size-24), var(--rz-size-40)) minmax(0, 1fr);
    min-height: var(--rz-size-9);
  }
  .rz-render-fields-preview__row + .rz-render-fields-preview__row {
    box-shadow: inset 0 1px 0 var(--rz-border);
  }
  .rz-render-fields-preview__name,
  .rz-render-fields-preview__value {
    display: flex;
    align-items: center;
    min-width: 0;
    padding-inline: var(--rz-size-3-5);
  }
  .rz-render-fields-preview__name {
    box-shadow: inset -1px 0 0 var(--rz-border);
    color: var(--rz-fg-subtle);
    > p {
      @mixin line-clamp 1;
    }
  }
  .rz-render-fields-preview__value {
    color: var(--rz-fg);
    span {
      @mixin line-clamp 1;
    }
  }
</style>
