<script lang="ts">
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { Link } from '@lucide/svelte';

  const { form }: { form: DocumentFormContext } = $props();
</script>

{#if form.values.url}
  <a href={form.values.url} class="rz-comp-url" target="_blank">
    <Link size="12" />
    {form.values.url}
  </a>
{/if}

<style>
  .rz-comp-url {
    background-color: var(--rz-bg-well);
    color: var(--rz-fg);
    border-radius: var(--rz-radius-md);
    display: inline-flex;
    gap: var(--rz-size-3);
    justify-content: flex-start;
    align-items: center;
    letter-spacing: 0.02em;
    padding: var(--rz-size-1) var(--rz-size-3);
    border: 1px solid var(--rz-border);
  }
</style>
