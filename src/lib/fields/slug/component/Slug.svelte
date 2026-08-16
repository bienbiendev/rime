<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { Input } from '$lib/panel/components/ui/input/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { slugify } from '$lib/util/string.js';
  import { Hash } from '@lucide/svelte';
  import type { SlugFieldBuilder } from '../index.js';

  type Props = { path: string; config: SlugFieldBuilder; form: DocumentFormContext };
  const { path, config, form }: Props = $props();

  const field = $derived(form.useField(path, config));
  let isFocused = false;
  // svelte-ignore state_referenced_locally
  const initialValue = form.getRawValue(path);
  const initialEmpty = !initialValue;
  const slugifySource = $derived(
    config.get.slugify ? form.useField<string>(config.get.slugify) : null
  );

  const slugifiedValue = $derived.by(() => {
    if (slugifySource && slugifySource.value) {
      return slugify(slugifySource.value);
    }
    return '';
  });

  $effect(() => {
    if (!isFocused && initialEmpty && slugifiedValue && field.value !== slugifiedValue) {
      field.value = slugifiedValue;
    }
  });

  const onInput = (event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const inputValue = inputElement.value;
    const slugifiedValue = slugify(inputValue.replace(' ', '-'));
    if (inputValue !== slugifiedValue) {
      inputElement.value = slugifiedValue;
    }
    field.value = inputElement.value;
  };

  const classNameCompact = $derived(
    config.get.layout === 'compact' ? 'rz-slug-field--compact' : ''
  );
  const classNames = $derived(`rz-slug-field ${classNameCompact || ''} ${config.get.className}`);
</script>

<fieldset class={classNames} use:fieldset={field}>
  <Field.Label {config} for={path || config.name} />

  <div class="rz-slug">
    <Input
      id={path || config.name}
      placeholder={config.get.placeholder}
      data-error={field.error ? '' : null}
      type="text"
      icon={Hash}
      value={field.value}
      name={path || config.name}
      oninput={onInput}
      onfocus={() => (isFocused = true)}
      onblur={() => (isFocused = false)}
    />

    {#if config.get.slugify}
      <Button
        disabled={!field.editable}
        onclick={() => (field.value = slugifiedValue)}
        type="button"
        size="sm"
        variant="secondary"
      >
        {t__('fields.generate_from', config.get.slugify)}
      </Button>
    {/if}
  </div>
  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style>
  .rz-slug {
    position: relative;

    :global(.rz-input) {
      font-family: var(--rz-font-mono);
    }

    :global(.rz-button) {
      position: absolute;
      right: var(--rz-size-1-5);
      top: var(--rz-size-1-5);
    }

    :global(.rz-slug__icon) {
      opacity: 0.37;
      position: absolute;
      left: 0.75rem;
      top: 1rem;
    }
  }

  .rz-slug-field--compact {
    :global(label) {
      display: none;
    }
    :global(.rz-field-error) {
      position: absolute;
      top: var(--rz-size-3);
      right: calc(var(--rz-fields-padding) + var(--rz-size-40));
    }
    :global(.rz-input) {
      font-size: var(--rz-text-md);
      padding: var(--rz-size-5) 0 var(--rz-size-5) var(--rz-size-8);
      height: var(--rz-size-11);
    }
  }
</style>
