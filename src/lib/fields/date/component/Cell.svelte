<script lang="ts">
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';

  type Props = { value: Date | undefined };
  const { value }: Props = $props();

  const locale = getLocaleContext();
</script>

{#if value}
  {locale.dateFormat(value)}
{/if}
