<script lang="ts">
  import type { Link } from '../types.js';

  type Props = {
    value: Link | null;
  };

  const { value: link }: Props = $props();
</script>

<div class="rz-link-cell">
  {#if link}
    {link.url || link.value || '—'}
  {/if}
</div>
