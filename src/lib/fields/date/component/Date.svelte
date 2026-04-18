<script lang="ts">
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import { Calendar } from '$lib/panel/components/ui/calendar/index.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
  import { Calendar as CalendarIcon } from '@lucide/svelte';
  import type { DateField } from '../index.js';

  type Props = { path: string; config: DateField; form: DocumentFormContext };

  const { path, config, form }: Props = $props();
  const locale = getLocaleContext();
  const timeZone = getLocalTimeZone();
  let dialogOpen = $state(false);
  const field = $derived(form.useField(path, config));

  // Derive date from field.value
  const date = $derived.by(() => {
    return field.value instanceof Date ? field.value : null;
  });

  // Derive calendarDate from date
  const calendarDate = $derived.by(() => {
    if (date) {
      return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }
    return undefined;
  });

  // Handle calendar selection changes
  function handleCalendarChange(newCalendarDate: DateValue | undefined) {
    if (newCalendarDate) {
      const newDate = newCalendarDate.toDate(timeZone);
      // Only update if the date actually changed
      if (!date || date.getTime() !== newDate.getTime()) {
        field.value = newDate;
      }
    } else if (field.value !== null) {
      field.value = null;
    }
  }

  const dateLabel = $derived(date ? locale.dateFormat(date) : 'Select a date');
</script>

<fieldset class="rz-date-field {config.className || ''}" use:root={field}>
  <Field.Label {config} for={path || config.name} />

  <Button
    id="foo"
    variant="secondary"
    data-empty={!calendarDate ? '' : null}
    data-error={field.error ? '' : null}
    class="rz-date__button"
    disabled={!field.editable}
    onclick={() => (dialogOpen = true)}
  >
    <CalendarIcon class="rz-date__icon" />
    {dateLabel}
  </Button>

  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content size="sm" class="rz-date__dialog-content">
      <Calendar
        type="single"
        value={calendarDate}
        onValueChange={handleCalendarChange}
        initialFocus
      />
    </Dialog.Content>
  </Dialog.Root>
  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  .rz-date-field :global {
    .rz-dialog-content.rz-date__dialog-content {
      width: 100px;
      padding: 12rem;
    }
    .rz-date__button.rz-button {
      width: 200px;
      justify-content: flex-start;
      border: var(--rz-border);
      padding-left: var(--rz-size-3);
      padding-right: var(--rz-size-3);
      height: var(--rz-input-height);
      text-align: left;
      font-weight: normal;
    }

    .rz-date__button[data-empty] {
      color: hsl(var(--rz-color-fg) / 0.7);
    }

    .rz-date__button[data-error] {
      border-color: var(--rz-color-alert);
    }

    .rz-date__icon {
      margin-right: var(--rz-size-2);
      height: var(--rz-size-4);
      width: var(--rz-size-4);
    }
  }
</style>
