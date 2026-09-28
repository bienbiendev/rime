<script lang="ts">
  type Props = {
    /** The person's name; the avatar shows its initials. */
    name: string;
    /** `xs` sits in a list row, `sm` in a card row. */
    size?: 'xs' | 'sm';
  };
  const { name, size = 'sm' }: Props = $props();

  // "Anthony Ivol" -> "AI", "anthony@site.com" -> "A"
  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
  );
</script>

<span class="rz-avatar rz-avatar--{size}" aria-hidden="true">{initials}</span>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  .rz-avatar {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-bg-active);
    color: var(--rz-fg-muted);
    text-transform: uppercase;
    @mixin font-semibold;
  }

  .rz-avatar--sm {
    width: --size(5.5);
    height: --size(5.5);
    font-size: var(--rz-text-2xs);
  }

  .rz-avatar--xs {
    width: --size(4.5);
    height: --size(4.5);
    font-size: calc(var(--rz-text-2xs) * 0.85);
  }
</style>
