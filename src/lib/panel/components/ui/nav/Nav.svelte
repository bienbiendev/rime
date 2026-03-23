<script lang="ts">
	import { page } from '$app/state';
	import { getConfigContext } from '$lib/panel/context/config.svelte.js';
	import type { Route } from '$lib/panel/types';
	import { panelUrl } from '$lib/panel/util/url.js';
	import { PanelsTopLeft } from '@lucide/svelte';
	import ScrollArea from '../scroll-area/scroll-area.svelte';
	import NavGroup from './NavGroup.svelte';
	import NavItem from './NavItem.svelte';
	import UserButton from './UserButton.svelte';

	type Props = {
		isCollapsed: boolean;
		setCollapsed: (value: boolean) => void;
		routes: Record<string, Route[]>;
	};
	const { isCollapsed, setCollapsed, routes: routesGroups }: Props = $props();

	const config = getConfigContext();
	const navigationGroupsConfig = config.raw.panel.navigation?.groups;

	const getGroupIcon = (groupName: string) => {
		if (!navigationGroupsConfig) return null;
		const group = navigationGroupsConfig.find((group) => group.label === groupName);
		if (group) {
			return group.icon;
		}
		return null;
	};

	const dashBoardRoute: Route = {
		title: 'Dashboard',
		url: panelUrl(),
		icon: PanelsTopLeft
	};
</script>

<div class:rz-nav--collapsed={isCollapsed} class="rz-nav">
	<div class="rz-nav__content">
		<div class="rz-nav__header" class:rz-nav__header--collapsed={isCollapsed}>
			<NavItem href="/panel" {isCollapsed} route={dashBoardRoute} />
		</div>

		<div class="rz-nav__body">
			<ScrollArea>
				{#key page.url}
					<nav class="rz-nav__nav">
						{#each Object.entries(routesGroups) as [groupName, routes], index (index)}
							{#if groupName !== 'none'}
								{@const icon = getGroupIcon(groupName)}
								<NavGroup name={groupName} {icon} navCollapsed={isCollapsed}>
									{#each routes as route (route.url)}
										<NavItem href={route.url} {isCollapsed} {route} />
									{/each}
								</NavGroup>
							{/if}
						{/each}
						{#each routesGroups.none as route (route.url)}
							<div class="rz-nav__group-none">
								<NavItem href={route.url} {isCollapsed} {route} />
							</div>
						{/each}
					</nav>
				{/key}
			</ScrollArea>

			<div class="rz-nav__user">
				<UserButton navCollapsed={isCollapsed} />
			</div>
		</div>
	</div>

	<button
		class="rz-nav__toggle"
		onclick={() => setCollapsed(!isCollapsed)}
		aria-label="Toggle navigation"
	>
	</button>
</div>

<style type="postcss">
	:root {
		--rz-nav-button-height: var(--rz-size-12);
		--rz-nav-bg: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-0)));

		--rz-nav-button-bg: light-dark(hsl(var(--rz-gray-19)), hsl(var(--rz-gray-3)));
		--rz-nav-group-bg: light-dark(hsl(var(--rz-gray-17)), hsl(var(--rz-gray-2)));
		--rz-nav-group-border-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-3)));
	}

	.rz-nav {
		position: fixed;
		z-index: 100;
		bottom: 0;
		left: 0;
		top: 0;
		padding: var(--rz-size-2) var(--rz-size-5);
		background-color: var(--rz-nav-bg);
		border-right: var(--rz-border);
		width: var(--rz-size-72);

		.rz-nav__toggle {
			position: absolute;
			display: none;
			align-items: center;
			justify-content: center;
			width: var(--rz-size-6);
			height: 100vh;
			right: 0;
			translate: var(--rz-size-3) 0;
			z-index: 10;
			top: 0;
			display: none;
			cursor: w-resize;
			padding: var(--rz-size-2);
			@media (min-width: 1024px) {
				display: flex;
			}
		}
	}
	.rz-nav--collapsed {
		width: var(--rz-size-20);
		padding: var(--rz-size-3);
		:global(.rz-button-nav) {
			justify-content: start;
		}
		.rz-nav__toggle {
			cursor: e-resize;
		}
	}
	.rz-nav__content {
		display: flex;
		height: 100%;
		flex-direction: column;
	}
	.rz-nav__header {
		display: flex;
		height: var(--rz-size-14);
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		padding-right: var(--rz-size-4);
		padding-left: var(--rz-size-4);

		&.rz-nav__header--collapsed {
			justify-content: center;
		}
	}
	.rz-nav__body {
		display: flex;
		height: 100%;
		flex-direction: column;
		justify-content: space-between;
	}
	.rz-nav__group-none {
		padding: 0 var(--rz-size-4);
		display: flex;
		flex-direction: column;
		gap: var(--rz-size-2);
	}
	.rz-nav__nav {
		border-radius: var(--rz-radius-lg);
	}
	.rz-nav--collapsed .rz-nav__nav {
		align-items: center;
	}
	.rz-nav__user {
		padding-bottom: var(--rz-size-2);
	}
</style>
