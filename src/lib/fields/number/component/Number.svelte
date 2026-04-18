<script lang="ts">
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import { ChevronDown, ChevronUp } from '@lucide/svelte';
  import './number.css';
  import type { NumberFieldProps } from './props';

  const { path, config, form }: NumberFieldProps = $props();

  const field = $derived(form.useField<number>(path, config));

  const decrease = () => {
    const minValue = config.min ?? -Infinity;
    field.value = Math.max((field.value || 0) - 1, minValue);
  };

  const increase = () => {
    const maxValue = config.max ?? Infinity;
    field.value = Math.min((field.value || 0) + 1, maxValue);
  };
</script>

{#snippet chevron(Icon: any, func: any, clss: string)}
  <button type="button" class="rz-number-field__chevron {clss}" onclick={func}>
    <Icon size={12} />
  </button>
{/snippet}

<fieldset class="rz-number-field {config.className || ''}" use:root={field}>
  <Field.Label {config} for={path || config.name} />
  <div class="rz-number-field__input-wrapper">
    <input
      class="rz-number-field__input"
      min={config.min ?? undefined}
      max={config.max ?? undefined}
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
  .rz-number-field__input-wrapper {
    width: 6rem;
    display: flex;
    height: var(--rz-size-11);
    align-items: center;
    border-radius: var(--rz-radius-lg);
  }

  .rz-number-field__input {
    background-color: hsl(var(--rz-input-bg));
    height: 100%;
    width: 100%;
    flex: 1;
    justify-content: center;
    border-top-left-radius: var(--rz-radius-lg);
    border-bottom-left-radius: var(--rz-radius-lg);
    border: 1px solid var(--rz-input-border-color);
    text-align: center;
    transition: all 0.2s ease;
  }

  .rz-number-field__input:focus-visible {
    position: relative;
    z-index: 10;
    @mixin ring var(--rz-color-ring);
    outline: none;
  }

  .rz-number-field__controls {
    display: flex;
    flex-direction: column;
    height: var(--rz-size-11);
  }

  .rz-number-field__chevron {
    background-color: hsl(var(--rz-input-bg));
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--rz-size-8);
    flex: 1;
    border-right: 1px solid var(--rz-input-border-color);
    transition: all 0.2s ease;
  }

  .rz-number-field__chevron:hover {
    background-color: hsl(var(--rz-gray-9));
  }

  .rz-number-field__chevron:focus-visible {
    @mixin ring var(--rz-color-ring);
    position: relative;
    z-index: 10;
    outline: none;
  }

  .rz-number-field__chevron--up {
    border-top: 1px solid var(--rz-input-border-color);
    border-top-right-radius: var(--rz-radius-lg);
    border-bottom: 1px solid var(--rz-input-border-color);
  }

  .rz-number-field__chevron--down {
    border-bottom-right-radius: var(--rz-radius-lg);
    border-bottom: 1px solid var(--rz-input-border-color);
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
