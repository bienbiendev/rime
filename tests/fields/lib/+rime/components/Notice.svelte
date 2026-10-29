<!-- The component-field fixture: listings.ts hides it by access and by condition. -->
<script lang="ts">
  const { config }: { config: { name: string } } = $props();
</script>

<p class="rz-fixture-notice">Notice {config.name}</p>
