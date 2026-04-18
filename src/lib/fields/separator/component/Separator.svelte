<script lang="ts">
  type Props = { class?: string };
  const { class: className }: Props = $props();
</script>

<hr class="rz-separator {className}" />

<style>
  .rz-separator {
    margin-bottom: var(--rz-size-4);
  }
</style>
