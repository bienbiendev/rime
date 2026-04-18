<script lang="ts">
  import { Calendar as CalendarPrimitive } from 'bits-ui';
  import { ChevronLeft } from '@lucide/svelte';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
  <ChevronLeft size="16" />
{/snippet}

<CalendarPrimitive.PrevButton
  bind:ref
  class="rz-calendar-prev-button rz-button rz-button--outline {className}"
  children={children || Fallback}
  {...restProps}
/>
