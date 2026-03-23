import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { TimeField } from '../index.js';

export type TimeFieldProps = {
	path?: string;
	config: TimeField;
	form: DocumentFormContext;
};
