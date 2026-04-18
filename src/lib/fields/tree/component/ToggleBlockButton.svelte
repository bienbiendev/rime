<script lang="ts">
  import { ChevronDown, ChevronUp } from '@lucide/svelte';

  type Props = { toggle: any; isOpen: boolean };
  const { toggle, isOpen }: Props = $props();
</script>

<button class="rz-toggle-block" type="button" onclick={toggle}>
  {#if isOpen}
    <ChevronUp size="12" />
  {:else}
    <ChevronDown size="12" />
  {/if}
</button>

<style>
  button {
    padding: var(--rz-size-2);
  }
</style>
