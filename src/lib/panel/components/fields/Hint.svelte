<script lang="ts">
  import type { FormFieldBuilder } from '$lib/fields';
  import type { FormField } from '$lib/fields/types.js';
  import type { Snippet } from 'svelte';

  /**
   * The line under a field: its hint, then what the field adds to it, a link for instance.
   *
   * ```svelte
   * <Field.Hint {config}>
   *   <button type="button" onclick={build}>Build it from the title</button>
   * </Field.Hint>
   * ```
   */
  type Props = { config: FormFieldBuilder<FormField>; children?: Snippet };
  const { config, children }: Props = $props();
</script>

{#if config.get.hint || children}
  <p class="rz-field-hint">
    {config.get.hint ?? ''}
    {@render children?.()}
  </p>
{/if}

<style type="postcss">
  @import '../../style/mixins/index.css';

  .rz-field-hint {
    margin-top: var(--rz-size-1-5);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    text-wrap: pretty;
  }

  .rz-field-hint :global(:is(a, button)) {
    color: var(--rz-accent-text);
    border-radius: var(--rz-radius-sm);

    &:hover:not(:disabled) {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    &:focus-visible {
      @mixin focus-ring;
    }
    &:disabled {
      color: var(--rz-fg-subtle);
      cursor: default;
    }
  }
</style>
