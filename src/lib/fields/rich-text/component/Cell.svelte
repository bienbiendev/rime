<script lang="ts">
  import { richTextJSONToText } from '../index.js';

  let { value }: { value: string } = $props();

  let textValue: string = $derived(richTextJSONToText(value));
</script>

{#if textValue && textValue.length > 10}
  {textValue.substring(0, 20)}...
{:else if textValue}
  {textValue}
{/if}
