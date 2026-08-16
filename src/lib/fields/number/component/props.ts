import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { NumberFieldBuilder } from '../index.js';

export type NumberFieldProps = {
  path: string;
  config: NumberFieldBuilder;
  form: DocumentFormContext;
};
