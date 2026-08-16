import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { SelectFieldBuilder } from '../index.js';

export type SelectFieldProps = {
  path: string;
  config: SelectFieldBuilder;
  form: DocumentFormContext;
};
