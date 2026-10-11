<script lang="ts">
  import { Calendar as CalendarPrimitive } from 'bits-ui';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
  <ChevronRight size={16} />
{/snippet}

<CalendarPrimitive.NextButton
  bind:ref
  class="rz-calendar-next-button {className}"
  children={children || Fallback}
  {...restProps}
/>
