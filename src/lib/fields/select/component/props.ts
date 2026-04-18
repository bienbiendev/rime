import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { SelectField } from '../index.js';

export type SelectFieldProps = {
  path: string;
  config: SelectField;
  form: DocumentFormContext;
};
