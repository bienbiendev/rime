<script lang="ts">
  import type { FieldBuilder } from '#lib/core/fields/builders/index.js';
  import { isFormField, isLiveField, isNotHidden, isPresentative } from '#lib/core/fields/util.js';
  import { ComponentFieldBuilder } from '#lib/fields/component/index.js';
  import { isTabsField } from '#lib/fields/tabs/index.js';
  import type { FormField } from '#lib/fields/types.js';
  import { type DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { getUserContext } from '#lib/panel/context/user.svelte.js';
  import type { GenericDoc } from '#lib/types.js';
  import type { WithOptional } from '#lib/util/types.js';

  type Props = {
    path?: string;
    fields: FieldBuilder[];
    form: DocumentFormContext<WithOptional<GenericDoc, 'id'>>;
  };

  const { form, fields, path = '' }: Props = $props();

  const user = getUserContext();

  const authorizedFields = $derived(
    fields.filter((field) => field.use.accessRead(user.attributes, { id: form.values.id }))
  );

  /** What goes before a field name: `meta` -> `meta.`, the root -> ``. */
  const prefix = $derived(path === '' ? '' : `${path}.`);

  const widthClassModifier = (field: FormField) =>
    `rz-render-fields__field--${field.width || 'full'}`;
</script>

<div class="rz-render-fields">
  {#each authorizedFields as field, index (index)}
    {#if !form.isLive || (form.isLive && isLiveField(field.get))}
      {#if field instanceof ComponentFieldBuilder}
        {#if field.use.isVisible(form.values)}
          {@const FieldComponent = field.get.component}
          <div data-type={field.type} class="rz-render-fields__field rz-render-fields__field--full">
            <FieldComponent path={prefix} config={field} {form} />
          </div>
        {/if}
      {:else if isPresentative(field.get)}
        {@const Separator = field.component}
        <div data-type={field.type} class="rz-render-fields__field rz-render-fields__field--full">
          <Separator class={field.get.className} />
        </div>
      {:else if isTabsField(field.get)}
        {@const Tabs = field.component}
        <div data-type="tabs" class="rz-render-fields__field rz-render-fields__field--full">
          <Tabs config={field} {path} {form} />
        </div>
      {:else if isFormField(field) && isNotHidden(field)}
        {@const isCompact = 'layout' in field.get && field.get.layout === 'compact'}
        {@const FieldComponent = field.component}
        <div
          class="rz-render-fields__field {widthClassModifier(field.get)}"
          data-type={field.type}
          data-compact={isCompact ? '' : null}
        >
          <FieldComponent path={prefix + field.name} config={field} {form} />
        </div>
      {/if}
    {/if}
  {/each}
</div>

<style type="postcss">
  /**
   * A 12-column grid of fields.
   *
   *   --rz-fields-gap: between two rows of fields, 24px unless a container sets it; the yes/no
   *                    rows read it to close it
   */
  .rz-render-fields {
    position: relative;
    gap: var(--rz-fields-gap, var(--rz-size-6)) min(2%, var(--rz-size-8));
    display: grid;
    container-type: inline-size;
    grid-template-columns: repeat(12, 1fr);
    height: fit-content;
    padding-left: var(--rz-fields-padding);
    padding-right: var(--rz-fields-padding);

    & > * {
      position: relative;
    }
  }

  /** A smaller gap when every field is compact. */
  .rz-render-fields:not(:has(> :not(.rz-render-fields__field[data-compact]))) {
    row-gap: var(--rz-size-4);
  }

  /** hide fields that doesn't have any data-visible children */
  .rz-render-fields__field:not(.rz-render-fields__field[data-type='component']):not(
      .rz-render-fields__field[data-type='separator']
    ):not(:has([data-visible])) {
    display: none;
  }

  .rz-render-fields__field--full,
  .rz-render-fields__field--1\/2,
  .rz-render-fields__field--1\/3,
  .rz-render-fields__field--2\/3 {
    grid-column: span 12 / span 12;
  }

  /* Side by side from 36rem: the document's 40rem column holds halves and thirds. */
  @container (min-width: 36rem) {
    .rz-render-fields__field--1\/3 {
      grid-column: span 4 / span 4;
    }
    .rz-render-fields__field--2\/3 {
      grid-column: span 8 / span 8;
    }
    .rz-render-fields__field--1\/2 {
      grid-column: span 6 / span 6;
    }
    .rz-render-fields__field--full {
      grid-column: span 12 / span 12;
    }
  }
</style>
