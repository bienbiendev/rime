import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { ToggleField } from '../index.js';

export type ToggleProps = {
  path: string;
  config: ToggleField;
  form: DocumentFormContext;
};
