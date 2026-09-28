<script lang="ts">
  import { Button } from '../../ui/button/index.js';

  type Props = {
    /** The staff member holding the lock, as the read joined them. */
    holder?: { name?: string | null; email?: string | null } | null;
    takeControl: () => void;
  };
  const { holder, takeControl }: Props = $props();

  const label = $derived(holder?.email ?? holder?.name ?? 'Someone');
</script>

<div class="rz-document-read-only">
  <p>{label} is editing the document</p>
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
    background: oklch(from var(--rz-bg-page) l c h / 0.8);
    backdrop-filter: blur(var(--rz-overlay-blur));
  }
</style>
