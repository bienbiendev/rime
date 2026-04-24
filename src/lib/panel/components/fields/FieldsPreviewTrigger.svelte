<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = { children: Snippet } & HTMLButtonAttributes;
  const { children, class: className, ...rest }: Props = $props();
</script>

<button class="rz-fields-preview__trigger {className || ''}" {...rest} type="button">
  {@render children()}
</button>

<style>
  .rz-fields-preview__trigger {
    display: block;
    background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-3)));
    width: 100%;
    text-align: left;
  }
</style>
