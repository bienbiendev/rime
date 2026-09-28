<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import { Input } from '$lib/panel/components/ui/input/index.js';
  import { Clock } from '@lucide/svelte';
  import type { TimeFieldProps } from './props.js';

  const { path, config, form }: TimeFieldProps = $props();
  const field = $derived(form.useField(path || config.name, config));

  const onInput = (event: Event) => {
    field.value = (event.target as HTMLInputElement).value;
  };
</script>

<fieldset class="rz-time-field {config.get.className || ''}" use:fieldset={field}>
  <Field.Label {config} for={path || config.name} />
  <div class="rz-time-field__input-wrapper">
    <Input
      type="time"
      id={path || config.name}
      name={path || config.name}
      data-error={field.error ? '' : null}
      value={field.value}
      oninput={onInput}
    />
    <span class="rz-time-field__icon">
      <Clock size="12" />
    </span>
  </div>
  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style>
  .rz-time-field__input-wrapper {
    display: flex;
    width: var(--rz-size-52);
    position: relative;
    :global {
      .rz-input {
        display: block;
      }
      /* The browser's own clock stays clickable, unseen, under ours. */
      .rz-input::-webkit-calendar-picker-indicator {
        opacity: 0;
        cursor: pointer;
      }
    }
  }

  .rz-time-field__icon {
    position: absolute;
    top: 0;
    bottom: 0;
    right: var(--rz-size-3);
    display: flex;
    align-items: center;
    color: var(--rz-fg-subtle);
    pointer-events: none;
  }
</style>
