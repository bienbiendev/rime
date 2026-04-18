<script lang="ts">
  import { Calendar as CalendarPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.HeaderProps = $props();
</script>

<CalendarPrimitive.Header bind:ref class="rz-calendar-header {className}" {...restProps} />
