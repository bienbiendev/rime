import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { ComboBoxField } from '../index.js';

export type ComboBoxProps = {
	path: string;
	config: ComboBoxField;
	form: DocumentFormContext;
};
