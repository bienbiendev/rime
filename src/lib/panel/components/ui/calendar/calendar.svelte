<script lang="ts">
  import { Calendar as CalendarPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import * as Calendar from './index.js';
  import './calendar.css';

  let {
    ref = $bindable(null),
    value = $bindable(),
    placeholder = $bindable(),
    class: className,
    weekdayFormat = 'short',
    ...restProps
  }: WithoutChildrenOrChild<CalendarPrimitive.RootProps> = $props();
</script>

<CalendarPrimitive.Root
  bind:ref
  bind:value
  bind:placeholder
  {weekdayFormat}
  class="rz-calendar {className}"
  {...restProps as any}
>
  {#snippet children({ months, weekdays })}
    <Calendar.Header>
      <Calendar.PrevButton />
      <Calendar.Heading />
      <Calendar.NextButton />
    </Calendar.Header>
    <Calendar.Months>
      {#each months as month, index (index)}
        <Calendar.Grid>
          <Calendar.GridHead>
            <Calendar.GridRow>
              {#each weekdays as weekday, index (index)}
                <Calendar.HeadCell>
                  {weekday.slice(0, 2)}
                </Calendar.HeadCell>
              {/each}
            </Calendar.GridRow>
          </Calendar.GridHead>
          <Calendar.GridBody>
            {#each month.weeks as weekDates, index (index)}
              <Calendar.GridRow>
                {#each weekDates as date, index (index)}
                  <Calendar.Cell {date} month={month.value}>
                    <Calendar.Day />
                  </Calendar.Cell>
                {/each}
              </Calendar.GridRow>
            {/each}
          </Calendar.GridBody>
        </Calendar.Grid>
      {/each}
    </Calendar.Months>
  {/snippet}
</CalendarPrimitive.Root>
