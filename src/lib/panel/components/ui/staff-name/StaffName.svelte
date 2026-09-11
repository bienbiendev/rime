<script lang="ts">
  /**
   * A staff member's name, resolved by the load that built this page.
   *
   * It takes a name, not an id, and that is the point: `staff.access.read` is `isAdmin`, so a
   * component that went and fetched one would render a dash for every editor — exactly the people
   * the edit lock and the authorship columns are for. `withStaffNames` resolves them server-side
   * and hands them down on the document as `_<field>Name`.
   */
  type Props = { name?: string | null; fallback?: string };
  const { name, fallback = '—' }: Props = $props();
</script>

<span class="rz-staff-name">{name || fallback}</span>

<style lang="postcss">
  .rz-staff-name {
    @mixin line-clamp 1;
  }
</style>
