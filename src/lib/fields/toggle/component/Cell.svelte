<script lang="ts">
  import Switch from '$lib/panel/components/ui/switch/switch.svelte';

  type Props = {
    value: boolean | null;
  };

  const { value }: Props = $props();
</script>

<div class="rz-toggle-cell">
  <Switch disabled checked={!!value} />
</div>

<style type="postcss">
  .rz-toggle-cell {
    scale: 0.8;
    transform-origin: left;
  }
</style>
