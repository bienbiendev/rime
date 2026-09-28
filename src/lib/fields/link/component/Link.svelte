<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import Checkbox from '$lib/panel/components/ui/checkbox/checkbox.svelte';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { Input } from '$lib/panel/components/ui/input/index.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import type { PrototypeSlug } from '$lib/types';
  import { capitalize } from '$lib/util/string.js';
  import { Anchor, AtSign, ChevronDown, FileText, Link2, Phone } from '@lucide/svelte';
  import type { Link, LinkType } from '../types';
  import type { LinkFieldProps } from './props';
  import RessourceInput from './RessourceInput.svelte';

  const { path, config, form }: LinkFieldProps = $props();

  const icons: Record<string, any> = {
    url: Link2,
    email: AtSign,
    tel: Phone,
    anchor: Anchor
  };

  const placeholders: Record<string, string> = {
    url: 'https://',
    email: 'email@zola.fr',
    tel: '+330700000000',
    anchor: 'my-anchor'
  };

  const primitiveTypes = ['url', 'email', 'tel', 'anchor'];
  const field = $derived(form.useField<Link>(path, config));
  const linkTypes = $derived(config.get.types);
  const plainTypes = $derived(linkTypes.filter((type) => primitiveTypes.includes(type)));
  const documentTypes = $derived(linkTypes.filter((type) => !primitiveTypes.includes(type)));

  const panelConfig = getConfigContext();

  /** url -> URL, tel -> Phone, pages -> Page: a collection by its singular label. */
  function typeLabel(type: string) {
    if (primitiveTypes.includes(type)) return t__(`fields.link_${type}`);
    return panelConfig.getCollection(type)?.label.singular || capitalize(type);
  }
  const initial = $derived(path ? form.getRawValue<Link>(path) : null);

  let initialLinkType = $derived(initial?.type || linkTypes[0]);
  let initialLinkValue = $derived(initial?.value || '');
  let initialTargetBlank = $derived((initial?.target && initial.target === '_blank') || false);

  let inputValue = $derived(initialLinkValue);
  let linkType = $derived(initialLinkType);
  let linkValue = $derived(initialLinkValue);
  let targetBlank = $derived(initialTargetBlank);

  let isPrimitiveType = $derived(primitiveTypes.includes(linkType));
  let Icon = $derived(icons[linkType] || FileText);
  let placeholder = $derived(placeholders[linkType] || '');
  let ressourceId = $derived(!primitiveTypes.includes(initialLinkType) ? initialLinkValue : '');
  const hasTarget = $derived(!['anchor', 'email', 'tel'].includes(linkType));

  let isLinkValueError = $state(false);
  let isLinkRequiredError = $derived(!!field.error && field.error.includes(`required::`));

  const onInput = (event: Event) => {
    linkValue = (event.target as HTMLInputElement).value;
    setValue();
  };

  const onTypeChange = (type: string | undefined) => {
    linkType = (type || 'url') as LinkType;
    inputValue = '';
    ressourceId = '';
    setValue();
    if (!form.errors.hasRequired(path || config.name)) {
      form.errors.delete(path || config.name);
    }
  };

  // For ressource links, whenever the ressourceId change, update the field value
  $effect(() => {
    if (!isPrimitiveType) {
      if ((field.value && ressourceId !== field.value.value) || (!field.value && ressourceId)) {
        linkValue = ressourceId;
        setValue();
      }
    }
  });

  const onTargetChange = (value: boolean) => {
    targetBlank = value;
    setValue();
  };

  const setValue = () => {
    const value: Link = {
      type: linkType,
      value: linkValue,
      target: targetBlank ? '_blank' : '_self'
    };
    field.value = value;
  };

  $effect(() => {
    const linkTypeError = !!field.error && field.error.includes(`${linkType}::`);
    isLinkValueError = linkTypeError || (isLinkRequiredError && !linkValue);
  });
</script>

<fieldset
  class="rz-link-field {config.get.className}"
  data-compact={config.get.layout === 'compact' ? '' : null}
  use:fieldset={field}
>
  <Field.Label {config} for={path || config.name} />

  <!-- One well: the type, the value, then whether it opens in a new tab. -->
  <div class="rz-link-field__row" data-error={isLinkValueError ? '' : null}>
    {#if linkTypes.length === 1}
      <span class="rz-link__type rz-link__type--single" title={typeLabel(linkType)}>
        <Icon size={14} />
      </span>
    {:else}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="rz-link__type">
          {#snippet child({ props })}
            <button type="button" {...props}>
              <Icon size={14} />
              <span class="rz-link__type-text">{typeLabel(linkType)}</span>
              <ChevronDown class="rz-link__type-chevron" size={12} />
            </button>
          {/snippet}
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content class="rz-link__type-content" align="start">
            <DropdownMenu.RadioGroup onValueChange={onTypeChange} bind:value={linkType}>
              {#each plainTypes as type (type)}
                <DropdownMenu.RadioItem value={type}>{typeLabel(type)}</DropdownMenu.RadioItem>
              {/each}
              {#if plainTypes.length && documentTypes.length}
                <DropdownMenu.Separator />
              {/if}
              {#each documentTypes as type (type)}
                <DropdownMenu.RadioItem value={type}>{typeLabel(type)}</DropdownMenu.RadioItem>
              {/each}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span class="rz-link__sep" aria-hidden="true"></span>
    {/if}

    {#if isPrimitiveType}
      <Input
        id={path || config.name}
        name={path || config.name}
        value={inputValue}
        {placeholder}
        oninput={onInput}
      />
    {:else}
      <RessourceInput
        error={isLinkValueError}
        type={linkType as PrototypeSlug}
        bind:ressourceId
        readOnly={form.readOnly}
      />
    {/if}

    {#if hasTarget}
      <span class="rz-link__sep" aria-hidden="true"></span>
      <span class="rz-link__target">
        <Checkbox checked={targetBlank} onCheckedChange={onTargetChange} id="{path}.target" />
        <label for="{path}.target">{t__('fields.new_tab')}</label>
      </span>
    {/if}
  </div>

  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style type="postcss">
  @import '../../../panel/style/mixins/index.css';

  .rz-link-field[data-compact] :global {
    .rz-link-field__row + .rz-field-error {
      top: -1.3rem;
    }
    .rz-field-label {
      display: none;
    }
  }

  /*
   * One well like any input: [type ▾ | value | ☐ New tab]
   * One type: its icon alone, no menu. The ring goes around the whole well.
   */
  .rz-link-field__row {
    @mixin well;
    display: flex;
    align-items: center;
    height: var(--rz-input-height);
    border-radius: var(--rz-radius-lg);

    &:focus-within {
      @mixin focus-field;
    }
    &[data-error] {
      @mixin invalid-field;
    }

    /* The value's own input and search draw no well of their own. */
    :global(.rz-input-wrapper) {
      flex: 1;
      min-width: 0;
    }
    :global(.rz-input),
    :global(.rz-input:focus-visible) {
      height: 100%;
      border: 0;
      border-radius: 0;
      background-color: transparent;
      box-shadow: none;
    }
    :global(.rz-input) {
      padding-inline: var(--rz-size-2-5);
    }
    :global(.rz-ressource-input) {
      flex: 1;
      min-width: 0;
      height: 100%;
    }
  }

  .rz-link__type {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-1-5);
    align-self: stretch;
    padding: 0 var(--rz-size-2) 0 --size(2.75);
    border-radius: var(--rz-radius-lg) 0 0 var(--rz-radius-lg);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-sm);
    transition: color 0.15s;

    :global(.rz-link__type-chevron) {
      color: var(--rz-fg-subtle);
    }

    &:is(button):hover,
    &[data-state='open'] {
      color: var(--rz-fg);
    }

    &:focus-visible {
      outline: none;
      background-color: var(--rz-bg-hover);
    }
  }

  .rz-link__type--single {
    padding-right: 0;
    color: var(--rz-fg-subtle);
  }

  /* A short divider between the parts. */
  .rz-link__sep {
    flex-shrink: 0;
    width: 1px;
    height: var(--rz-size-4);
    background-color: var(--rz-border-strong);
  }

  .rz-link__target {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-2);
    padding: 0 var(--rz-size-3) 0 var(--rz-size-2-5);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-sm);
    white-space: nowrap;

    label {
      cursor: pointer;
    }
  }

  /* A narrow field: the type's icon alone, the checkbox without its words. */
  @container rz-field-root (max-width: 420px) {
    .rz-link__type-text,
    .rz-link__target label {
      display: none;
    }
  }
</style>
