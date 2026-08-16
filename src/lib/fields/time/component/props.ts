import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { TimeFieldBuilder } from '../index.js';

export type TimeFieldProps = {
  path?: string;
  config: TimeFieldBuilder;
  form: DocumentFormContext;
};
