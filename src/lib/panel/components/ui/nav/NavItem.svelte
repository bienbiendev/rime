<script lang="ts">
	import { page } from '$app/state';
	import * as Tooltip from '$lib/panel/components/ui/tooltip';
	import { getConfigContext } from '$lib/panel/context/config.svelte.js';
	import type { Route } from '$lib/panel/types';
	import { File } from '@lucide/svelte';
	import NavItemButton from './NavItemButton.svelte';

	type Props = {
		isCollapsed: boolean;
		route: Route;
		[x: string]: any;
	};
	const { isCollapsed, route, ...rest }: Props = $props();

	const config = getConfigContext();

	const RouteIcon =
		typeof route.icon === 'function' ? route.icon : config.raw.icons[route.icon] || File;

	let pathname = page.url.pathname;

	let active = $derived.by(() => {
		const routePathname = new URL(route.url).pathname;
		if (routePathname === '/panel') {
			return pathname === '/panel';
		}
		const reg = new RegExp(`^${routePathname}(/.*)?$`);
		return reg.test(pathname);
	});
</script>

{#if isCollapsed}
	<Tooltip.Provider>
		<Tooltip.Root delayDuration={100}>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<NavItemButton icon={RouteIcon} {active} {...rest} {...props} />
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content side="right">
					{route.title}
				</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	<NavItemButton icon={RouteIcon} {active} {...rest}>
		{route.title}
	</NavItemButton>
{/if}
