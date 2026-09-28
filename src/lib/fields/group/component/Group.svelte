<script lang="ts">
  import { FormFieldBuilder } from '$lib/core/fields/builders';
  import { isFormField } from '$lib/core/fields/util.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import type { GroupFieldBuilder } from '$lib/fields/group/index.js';
  import { TabsBuilder } from '$lib/fields/tabs';
  import FieldsPreview from '$lib/panel/components/fields/FieldsPreview.svelte';
  import FieldsPreviewTrigger from '$lib/panel/components/fields/FieldsPreviewTrigger.svelte';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { ChevronDown } from '@lucide/svelte';
  import { onMount } from 'svelte';

  type Props = {
    path: string;
    config: GroupFieldBuilder;
    form: DocumentFormContext<GenericDoc>;
  };
  const { config, path, form }: Props = $props();

  let groupOpen = $state(true);
  const key = $derived(
    `group-${config.get.fields
      .filter(isFormField)
      .map((f) => f.name)
      .join('-')}`
  );

  const field = $derived(form.useField(path));

  function handleClick() {
    groupOpen = !groupOpen;
    localStorage.setItem(key, groupOpen.toString());
  }

  onMount(() => {
    groupOpen = localStorage.getItem(key) === 'true';
  });

  const user = getUserContext() || undefined;

  // The preview shows the group's own values: a layout field has none, and tabs are one.
  const previewFields = $derived.by(() => {
    return config.get.fields
      .filter((field) => !(field instanceof TabsBuilder))
      .filter((field) => field instanceof FormFieldBuilder)
      .filter((field) => !form.isLive || (form.isLive && field.get.live))
      .filter((field) => field.use.accessRead(user.attributes, { id: form.values.id }));
  });

  const basePath = $derived(path ? `${path}.` : '');
</script>

<!-- A card: its name and a chevron, then its fields, or a preview of their values when folded. -->
<div
  class="rz-group-field__wrapper"
  class:rz-group-field__wrapper--hidden={!field.visible}
  class:rz-group-field__wrapper--open={groupOpen}
>
  <button
    onclick={handleClick}
    type="button"
    aria-expanded={groupOpen}
    class:open={groupOpen}
    class:rz-group-field__trigger--live={form.isLive}
    class="rz-group-field__trigger"
  >
    <span class="rz-group-field__title">{config.get.label || config.name || 'Group'}</span>
    <span class="rz-group-field__chevron" aria-hidden="true">
      <ChevronDown size="14" />
    </span>
  </button>

  {#if !groupOpen}
    <FieldsPreviewTrigger class="rz-group-field__preview" onclick={handleClick}>
      <FieldsPreview
        preview={config.get.preview}
        fields={previewFields}
        getField={(field) => form.useField(basePath + field.name)}
      />
    </FieldsPreviewTrigger>
  {:else}
    <div class="rz-group-field__content">
      <RenderFields {path} fields={config.get.fields} {form} />
    </div>
  {/if}
</div>

<style lang="postcss">
  @import '../../../panel/style/mixins/index.css';

  .rz-group-field__wrapper {
    @mixin surface raised;
    border-radius: var(--rz-radius-xl);
  }

  /* Inside a group, a block, a tree item or a stage card: a hairline, no second fill. */
  :global(.rz-group-field__content) .rz-group-field__wrapper,
  :global(.rz-block__fields) .rz-group-field__wrapper,
  :global(.rz-tree-item__fields) .rz-group-field__wrapper,
  :global(.rz-stage__fields) .rz-group-field__wrapper {
    background-color: transparent;
    box-shadow: 0 0 0 1px var(--rz-border);
  }

  /* The closed group's preview keeps to the card's rounded corners. */
  :global(.rz-group-field__preview) {
    overflow: hidden;
    border-radius: 0 0 var(--rz-radius-xl) var(--rz-radius-xl);
  }

  .rz-group-field__wrapper:global(:has(.rz-field-error)) {
    @mixin invalid-field;
  }

  .rz-group-field__wrapper--hidden {
    display: none;
  }

  /* The fields, 14px from the card's sides, 20px apart. */
  .rz-group-field__content {
    --rz-fields-padding: var(--rz-size-3-5);
    --rz-fields-gap: var(--rz-size-5);
    padding-block: var(--rz-size-4);
  }

  /* The card's head: its name, then a chevron; a hairline under it while the group is open. */
  .rz-group-field__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    width: 100%;
    height: var(--rz-size-10);
    padding: 0 var(--rz-size-1-5) 0 var(--rz-size-3-5);
    border-radius: var(--rz-radius-xl);
    text-align: left;
    @mixin font-medium;

    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-group-field__wrapper--open > .rz-group-field__trigger {
    border-radius: var(--rz-radius-xl) var(--rz-radius-xl) 0 0;
    box-shadow: inset 0 -1px 0 var(--rz-border);
  }

  .rz-group-field__title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rz-group-field__chevron {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--rz-size-7);
    height: var(--rz-size-7);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg-subtle);
    transition:
      color 0.15s,
      background-color 0.15s;

    :global(svg) {
      transition: rotate 0.2s ease;
    }
  }

  .rz-group-field__trigger:hover .rz-group-field__chevron {
    background-color: var(--rz-bg-hover);
    color: var(--rz-fg);
  }

  .rz-group-field__trigger.open .rz-group-field__chevron :global(svg) {
    rotate: -180deg;
  }

  .rz-group-field__trigger--live {
    font-size: var(--rz-text-md);
  }

  /* Folded: the values under a hairline, the card's bottom corners kept. */
  .rz-group-field__wrapper :global(.rz-group-field__preview) {
    border-radius: 0 0 var(--rz-radius-xl) var(--rz-radius-xl);
    box-shadow: inset 0 1px 0 var(--rz-border);
  }
</style>
