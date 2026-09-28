<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { OptionWithIcon } from '$lib/fields/types.js';
  import { Field } from '$lib/panel';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import * as Popover from '$lib/panel/components/ui/popover/index.js';
  import { Check, ChevronsUpDown } from '@lucide/svelte';
  import './combobox.css';
  import type { ComboBoxProps } from './props';

  const { path, config, form }: ComboBoxProps = $props();

  const field = $derived(form.useField(path, config));
  const options = $derived(config.get.options);

  let search = $state('');
  let open = $state(false);
  let selected = $derived<OptionWithIcon | undefined>(options.find((o) => o.value === field.value));
</script>

{#snippet label(option: OptionWithIcon)}
  <span class="rz-combobox__option-label">
    {#if option.icon}
      {@const Icon = option.icon}
      <Icon size="12" />
    {/if}
    {option?.label}
  </span>
{/snippet}

<fieldset class="rz-combobox-field {config.get.className || ''}" use:fieldset={field}>
  <Field.Label {config} for={path || config.name} />

  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          class="rz-combobox__trigger"
          {...props}
        >
          {#if selected}
            {@render label(selected)}
          {:else}
            <span class="rz-combobox__placeholder">{t__('fields.select')}</span>
          {/if}
          <ChevronsUpDown class="rz-combobox__chevron" />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content class="rz-combobox__content">
        <Command.Root>
          {#if options.length > 4}
            <Command.Input
              bind:value={search}
              placeholder={t__('common.search')}
              class="rz-combobox__search"
            />
          {/if}
          <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
          <Command.Group>
            {#each options as option, index (index)}
              <Command.Item
                class="rz-combobox__item"
                value={option.value}
                onSelect={() => {
                  selected = option;
                  field.value = option.value;
                  search = '';
                  open = false;
                }}
              >
                {@render label(option)}
                <Check
                  class={`rz-combobox__check ${selected?.value !== option.value ? 'rz-combobox__check--hidden' : ''}`}
                />
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.Root>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  @import '../../../panel/style/mixins/index.css';

  /* A well like an input: the picked option, or a quiet placeholder, then the chevron. */
  .rz-combobox-field :global {
    .rz-combobox__trigger.rz-button {
      min-width: var(--rz-size-52);
      height: var(--rz-input-height);
      padding-inline: var(--rz-size-3) var(--rz-size-2-5);
      justify-content: space-between;
      color: var(--rz-fg);
      @mixin well;
      @mixin font-normal;
      &:focus-visible {
        @mixin focus-field;
      }
    }
    .rz-combobox__placeholder {
      color: var(--rz-fg-subtle);
    }
  }
</style>
