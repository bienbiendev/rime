<script lang="ts">
  import { Calendar as CalendarPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.GridProps = $props();
</script>

<CalendarPrimitive.Grid bind:ref class="rz-calendar-grid {className}" {...restProps} />
