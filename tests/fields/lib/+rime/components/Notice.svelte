<script lang="ts">
  const { config }: { config: { name: string } } = $props();
</script>

<p class="rz-fixture-notice">Notice {config.name}</p>
