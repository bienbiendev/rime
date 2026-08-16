import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { ComboBoxFieldBuilder } from '../index.js';

export type ComboBoxProps = {
  path: string;
  config: ComboBoxFieldBuilder;
  form: DocumentFormContext;
};
