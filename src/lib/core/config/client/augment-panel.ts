import type { PanelConfig } from '$lib/core/config/types.js';
import { Book, BookCopy, BookType, SlidersVertical } from '@lucide/svelte';

export const augmentPanel = <const T extends { panel?: Omit<PanelConfig, '$access'> }>(
	config: T
) => {
	//
	const panelNavigationGroups = [
		...(config.panel?.navigation?.groups || []),
		{ label: 'content', icon: BookType },
		{ label: 'system', icon: SlidersVertical },
		{ label: 'collections', icon: BookCopy },
		{ label: 'areas', icon: Book }
	] as const;

	const panel = {
		...config.panel,
		routes: config.panel?.routes ? config.panel.routes : {},
		language: config.panel?.language || 'en',
		navigation: { groups: panelNavigationGroups },
		components: {
			header: config.panel?.components?.header || [],
			...(config.panel?.components?.dashboard && { dashboard: config.panel.components.dashboard })
		}
	} as const;

	return { ...config, panel } as const;
};
