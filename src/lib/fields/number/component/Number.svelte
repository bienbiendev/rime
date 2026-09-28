<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import { ChevronDown, ChevronUp } from '@lucide/svelte';
  import './number.css';
  import type { NumberFieldProps } from './props';

  const { path, config, form }: NumberFieldProps = $props();

  const field = $derived(form.useField<number>(path, config));

  const decrease = () => {
    const minValue = config.get.min ?? -Infinity;
    field.value = Math.max((field.value || 0) - 1, minValue);
  };

  const increase = () => {
    const maxValue = config.get.max ?? Infinity;
    field.value = Math.min((field.value || 0) + 1, maxValue);
  };
</script>

{#snippet chevron(Icon: any, func: any, clss: string)}
  <button type="button" class="rz-number-field__chevron {clss}" onclick={func}>
    <Icon size={12} />
  </button>
{/snippet}

<fieldset class="rz-number-field {config.get.className || ''}" use:fieldset={field}>
  <Field.Label {config} for={path || config.name} />
  <div class="rz-number-field__input-wrapper">
    <input
      class="rz-number-field__input"
      min={config.get.min ?? undefined}
      max={config.get.max ?? undefined}
      bind:value={field.value}
      type="number"
    />
    <div class="rz-number-field__controls">
      {@render chevron(ChevronUp, increase, 'rz-number-field__chevron--up')}
      {@render chevron(ChevronDown, decrease, 'rz-number-field__chevron--down')}
    </div>
  </div>
  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  @import '../../../panel/style/mixins/index.css';

  /* One well: the value, then the steppers. */
  .rz-number-field__input-wrapper {
    width: 6rem;
    display: flex;
    height: var(--rz-input-height);
    align-items: center;
    border-radius: var(--rz-radius-lg);
    @mixin well;
    &:focus-within {
      @mixin focus-field;
    }
  }

  .rz-number-field__input {
    background-color: transparent;
    height: 100%;
    width: 100%;
    flex: 1;
    justify-content: center;
    border-top-left-radius: var(--rz-radius-lg);
    border-bottom-left-radius: var(--rz-radius-lg);
    border: 0;
    text-align: center;
    transition: all 0.2s ease;
  }

  .rz-number-field__input:focus-visible {
    outline: none;
  }

  /* The steppers: a column of their own, a hairline before it and between them. */
  .rz-number-field__controls {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid var(--rz-border);
  }

  .rz-number-field__chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--rz-size-8);
    flex: 1;
    color: var(--rz-fg-subtle);
    transition: all 0.2s ease;
  }

  .rz-number-field__chevron:hover {
    background-color: var(--rz-bg-hover);
    color: var(--rz-fg);
  }

  .rz-number-field__chevron:focus-visible {
    @mixin focus-ring;
    position: relative;
    z-index: 10;
  }

  .rz-number-field__chevron--up {
    border-top-right-radius: var(--rz-radius-lg);
    border-bottom: 1px solid var(--rz-border);
  }

  .rz-number-field__chevron--down {
    border-bottom-right-radius: var(--rz-radius-lg);
  }

  /* Chrome, Safari, Edge, Opera */
  .rz-number-field__input::-webkit-outer-spin-button,
  .rz-number-field__input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Firefox */
  .rz-number-field__input[type='number'] {
    appearance: textfield;
    -moz-appearance: textfield;
  }
</style>
