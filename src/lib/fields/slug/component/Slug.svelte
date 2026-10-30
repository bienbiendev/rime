<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { fieldset } from '#lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '#lib/panel/components/fields/index.js';
  import { Input } from '#lib/panel/components/ui/input/index.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { slugify } from '#lib/util/string.js';
  import Hash from '@lucide/svelte/icons/hash';
  import type { SlugFieldBuilder } from '../index.js';

  type Props = { path: string; config: SlugFieldBuilder; form: DocumentFormContext };
  const { path, config, form }: Props = $props();

  const field = $derived(form.useField(path, config));
  /** The slug follows its source while the document opened with no slug, until the user types one. */
  // svelte-ignore state_referenced_locally
  let follows = $state(!form.getRawValue(path));
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
    if (follows && slugifiedValue && field.value !== slugifiedValue) {
      field.value = slugifiedValue;
    }
  });

  /**
   * Rewrites what is typed to its slug form. The first space becomes `-` before `slugify`, so a
   * space typed at the end survives its trim: "my page" reads "my-page" while typing.
   */
  const onInput = (event: Event) => {
    follows = false;
    const input = event.target as HTMLInputElement;
    const typed = slugify(input.value.replace(' ', '-'));
    if (input.value !== typed) {
      input.value = typed;
    }
    field.value = input.value;
  };

  /** The field the slug is built from, by its last name: `attributes.title` → `title`. */
  const sourceName = $derived(config.get.slugify?.split('.').at(-1) ?? '');

  const classNameCompact = $derived(
    config.get.layout === 'compact' ? 'rz-slug-field--compact' : ''
  );
  const classNames = $derived(`rz-slug-field ${classNameCompact} ${config.get.className || ''}`);
</script>

<fieldset class={classNames} use:fieldset={field}>
  <Field.Label {config} for={path || config.name} />

  <Input
    id={path || config.name}
    icon={Hash}
    placeholder={config.get.placeholder || slugify(config.get.label)}
    data-error={field.error ? '' : null}
    type="text"
    value={field.value}
    name={path || config.name}
    oninput={onInput}
  />

  <Field.Hint {config}>
    {#if !config.get.hint}{t__('fields.slug_hint')}{/if}
    {#if config.get.slugify}
      <button
        type="button"
        disabled={!field.editable || !slugifiedValue}
        onclick={() => (field.value = slugifiedValue)}
      >
        {t__('fields.build_from', sourceName)}
      </button>
    {/if}
  </Field.Hint>
  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  .rz-slug-field--compact {
    :global(.rz-field-label) {
      display: none;
    }
    :global(.rz-field-error) {
      top: var(--rz-size-1);
      right: var(--rz-size-1);
    }
  }
</style>
