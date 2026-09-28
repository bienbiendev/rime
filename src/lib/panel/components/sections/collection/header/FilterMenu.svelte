<script lang="ts">
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { ListFilter } from '@lucide/svelte';

  type Props = {
    /** What the button says while everything shows: "Status", "All types". */
    label: string;
    /** The choices, `all` first. */
    options: { value: string; label: string }[];
    value: string;
    onchange: (value: string) => void;
  };
  const { label, options, value, onchange }: Props = $props();

  const picked = $derived(value === 'all' ? null : options.find((o) => o.value === value));
</script>

<!-- A ghost button; its menu picks one choice, and the button then names it. -->
<div class="rz-filter-menu" data-active={picked ? '' : undefined}>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button variant="ghost" size="sm" icon={ListFilter} {...props}>
          {picked?.label ?? label}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioGroup {value} onValueChange={onchange}>
          {#each options as option (option.value)}
            <DropdownMenu.RadioItem value={option.value}>{option.label}</DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

<style type="postcss">
  .rz-filter-menu {
    --rz-button-ghost-fg: var(--rz-fg-muted);
    display: contents;

    :global(.rz-button__icon) {
      color: var(--rz-fg-subtle);
    }
  }

  /* A filter on: the button reads like the text it filters. */
  .rz-filter-menu[data-active] {
    --rz-button-ghost-fg: var(--rz-fg);

    :global(.rz-button__icon) {
      color: var(--rz-accent-text);
    }
  }
</style>
