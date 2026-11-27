<script>
	import '#lib/theme.css';
	import '#lib/base.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { store } from '#lib/store.svelte.js';
  import '@fortawesome/fontawesome-free/css/all.min.css';

	let { children, data } = $props();

	onMount(() => store.init());

	const tabs = $derived([
	{ href: '/', label: 'Home', icon: 'fa-solid fa-house' },
	{ href: '/log', label: 'Log', icon: 'fa-solid fa-pen-to-square' },
	{ href: '/progress', label: 'Progress', icon: 'fa-solid fa-chart-line' },
	...(data.user?.role === 'admin'
		? [{ href: '/admin', label: 'Admin', icon: 'fa-solid fa-shield-halved' }]
		: [])
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
					<i class={tab.icon} aria-hidden="true"></i>
					<span>{tab.label}</span>
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
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: var(--touch-target);
		color: var(--color-text-muted);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.tab i {
		font-size: 1.125rem;
	}

	.tab[aria-current='page'] {
		color: var(--color-accent);
	}
</style>
