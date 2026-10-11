<script lang="ts">
  import { RichText } from '../json.js';

  let { value }: { value: string } = $props();

  /** The longest text shown whole; a longer one is cut there and ends with "...". */
  const MAX_LENGTH = 20;

  let textValue: string = $derived(RichText.toText(value));
</script>

{#if textValue.length > MAX_LENGTH}
  {textValue.substring(0, MAX_LENGTH)}...
{:else}
  {textValue}
{/if}
