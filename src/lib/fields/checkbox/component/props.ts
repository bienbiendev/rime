import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { CheckboxFieldBuilder } from '../index.js';

export type CheckboxProps = {
  path: string;
  config: CheckboxFieldBuilder;
  form: DocumentFormContext;
};
