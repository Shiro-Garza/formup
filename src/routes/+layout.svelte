<script>
	import '#lib/theme.css';
	import '#lib/base.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { store } from '#lib/store.svelte.js';

	let { children, data } = $props();

	onMount(() => store.init());

	const tabs = $derived([
		{ href: '/', label: 'Home' },
		{ href: '/log', label: 'Log' },
		{ href: '/progress', label: 'Progress' },
		...(data.user?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])
	]);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>FormUp</title>
</svelte:head>

<div class="shell">
	<main class="content">
		{@render children()}
	</main>

	<nav class="tabbar" aria-label="Main">
		<div class="tabs" style="grid-template-columns: repeat({tabs.length}, 1fr)">
			{#each tabs as tab}
				<a
					class="tab"
					href={tab.href}
					aria-current={page.url.pathname === tab.href ? 'page' : undefined}
				>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
</div>

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.content {
		flex: 1;
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--space-6) var(--gutter) calc(var(--tabbar-height) + var(--space-6));
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.tabbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		height: var(--tabbar-height);
		background: var(--color-card);
		border-top: 1px solid var(--color-border);
	}

	.tabs {
		max-width: var(--content-max);
		height: 100%;
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}

	.tab {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--touch-target);
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.tab[aria-current='page'] {
		color: var(--color-accent);
	}
</style>
