<script lang="ts">
  import { Button } from '../../ui/button/index.js';

  type Props = { name?: string | null; takeControl: () => void };
  const { name, takeControl }: Props = $props();
</script>

<div class="rz-document-read-only">
  <p>{name} is editing the document</p>
  <Button variant="outline" onclick={takeControl}>Take control</Button>
</div>

<style lang="postcss">
  .rz-document-read-only {
    display: grid;
    gap: 1rem;
    place-content: center;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: light-dark(hsl(var(--rz-gray-12) / 0.8), hsl(var(--rz-gray-3) / 0.8));
    backdrop-filter: blur(2px);
  }
</style>
