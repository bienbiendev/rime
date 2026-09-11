<script lang="ts">
  import { Button } from '../../ui/button/index.js';
  import StaffName from '../../ui/staff-name/StaffName.svelte';

  type Props = { name?: string | null; takeControl: () => void };
  const { name, takeControl }: Props = $props();
</script>

<div class="rz-document-read-only">
  <p><StaffName {name} fallback="Someone" /> is editing the document</p>
  <Button variant="outline" onclick={takeControl}>Take control</Button>
</div>

<style lang="postcss">
  .rz-document-read-only {
    display: grid;
    gap: 1rem;
    place-content: center;
    position: absolute;
    inset: 0;
    z-index: 100;
    background: hsl(var(--rz-gray-11) / 0.8);
    backdrop-filter: blur(2px);
  }
</style>
