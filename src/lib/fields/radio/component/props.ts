import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { RadioFieldBuilder } from '../index.js';

export type RadioFieldProps = {
  path: string;
  config: RadioFieldBuilder;
  form: DocumentFormContext;
};
