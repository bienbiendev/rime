<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = { children: Snippet } & HTMLButtonAttributes;
  const { children, class: className, ...rest }: Props = $props();
</script>

<button class="rz-fields-preview__trigger {className || ''}" {...rest} type="button">
  {@render children()}
</button>

<style type="postcss">
  @import '../../style/mixins/index.css';

  .rz-fields-preview__trigger {
    display: block;
    width: 100%;
    text-align: left;
    transition: background-color 0.15s;

    &:hover {
      @mixin hover;
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }
</style>
