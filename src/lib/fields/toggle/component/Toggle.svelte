<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import '$lib/panel/components/fields/setting.css';
  import { Switch } from '$lib/panel/components/ui/switch/index.js';
  import { slugify } from '$lib/util/string.js';
  import type { ToggleProps } from './props.js';

  const { path, config, form }: ToggleProps = $props();
  const field = $derived(form.useField<boolean>(path, config));
  const inputId = $derived(slugify(`${form.key}-${path}`));

  const onCheckedChange = (bool: boolean) => {
    field.value = bool;
  };
</script>

<!-- A row of a card: the name and the hint, then the switch. -->
<fieldset class="rz-toggle-field rz-setting {config.get.className || ''}" use:fieldset={field}>
  <div class="rz-setting__row">
    <div class="rz-setting__text">
      <Field.LabelFor {config} for={inputId} />
      <Field.Hint {config} />
    </div>
    <Switch
      data-error={field.error ? '' : null}
      checked={field.value}
      {onCheckedChange}
      id={inputId}
    />
  </div>
</fieldset>
