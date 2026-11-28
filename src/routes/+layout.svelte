<script>
	import '#lib/theme.css';
	import '#lib/base.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { store } from '#lib/store.svelte.js';
	import '@fortawesome/fontawesome-free/css/all.min.css';

	let { children, data } = $props();

	// Account-specific fitness storage.
	let mounted = $state(false);

	// Reload the fitness store whenever the account changes.
	$effect(() => {
		if (!mounted) return;

		const user = data.user
			? {
				email: data.user.email,
				role: data.user.role
			}
			: null;

		untrack(() => {
			store.init(user);
		});
	});

	// Theme management.
	let theme = $state('dark');

	const THEME_KEY = 'formup:theme';

	function applyTheme(value) {
		theme = value === 'light' ? 'light' : 'dark';

		document.documentElement.setAttribute(
			'data-theme',
			theme
		);
	}

	function toggleTheme() {
		const nextTheme =
			theme === 'dark' ? 'light' : 'dark';

		applyTheme(nextTheme);

		try {
			localStorage.setItem(THEME_KEY, nextTheme);
		} catch {
			// Theme switching still works if storage is unavailable.
		}
	}

	onMount(() => {
		// Initialize storage for the current account.
		store.init(data.user ?? null);
		mounted = true;

		// Restore the saved theme preference.
		try {
			const savedTheme = localStorage.getItem(THEME_KEY);

			applyTheme(
				savedTheme === 'light' ? 'light' : 'dark'
			);
		} catch {
			applyTheme('dark');
		}

		// Synchronize the theme between browser tabs.
		function syncTheme(event) {
			if (event.key === THEME_KEY) {
				applyTheme(event.newValue);
			}
		}

		window.addEventListener('storage', syncTheme);

		return () => {
			window.removeEventListener('storage', syncTheme);
		};
	});

	// Navigation and administrator access.
	const tabs = $derived([
		{ href: '/', label: 'Home', icon: 'fa-solid fa-house' },
		{ href: '/log', label: 'Log', icon: 'fa-solid fa-pen-to-square' },
		{ href: '/progress', label: 'Progress', icon: 'fa-solid fa-chart-line' },
		{ href: '/schedule', label: 'Schedule', icon: 'fa-solid fa-calendar-days' },
		...(data.user?.role === 'admin'
			? [{ href: '/admin', label: 'Admin', icon: 'fa-solid fa-shield-halved' }]
			: [])
	]);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />

	<title>FormUp</title>

	<meta
		name="theme-color"
		content={theme === 'dark' ? '#0b1f3a' : '#eaf0f7'}
	/>
</svelte:head>

<div class="shell">
	<main class="content">

		<!-- Global theme controls -->
		<div class="theme-toolbar">
			<button
				type="button"
				class="theme-toggle"
				onclick={toggleTheme}
				aria-label={theme === 'dark'
					? 'Switch to light mode'
					: 'Switch to dark mode'}
				title={theme === 'dark'
					? 'Switch to light mode'
					: 'Switch to dark mode'}
			>
				{#if theme === 'dark'}

					<!-- Sun icon -->
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2M12 20v2" />
						<path d="m4.93 4.93 1.42 1.42" />
						<path d="m17.65 17.65 1.42 1.42" />
						<path d="M2 12h2M20 12h2" />
						<path d="m4.93 19.07 1.42-1.42" />
						<path d="m17.65 6.35 1.42-1.42" />
					</svg>

					<span>Light mode</span>

				{:else}

					<!-- Moon icon -->
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M20.985 12.486A9 9 0 1 1 11.514 3.015a7 7 0 0 0 9.471 9.471Z"
						/>
					</svg>

					<span>Dark mode</span>
				{/if}
			</button>
		</div>

		<!-- Page content -->
		{@render children()}
	</main>

	<!-- Bottom navigation -->
	<nav class="tabbar" aria-label="Main">
		<div
			class="tabs"
			style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr))"
		>
			{#each tabs as tab}
				<a
					class="tab"
					href={tab.href}
					aria-current={page.url.pathname === tab.href
						? 'page'
						: undefined}
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
		padding:
			var(--space-6)
			var(--gutter)
			calc(var(--tabbar-height) + var(--space-6));
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* Global theme toolbar */

	.theme-toolbar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--touch-target);
		padding: var(--space-2) var(--space-3);
		background: var(--color-card);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}

	.theme-toggle svg {
		color: var(--color-accent);
		flex-shrink: 0;
	}

	.theme-toggle:hover {
		border-color: var(--color-accent);
	}

	.theme-toggle:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 3px;
	}

	/* Bottom navigation */

	.tabbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		height: var(--tabbar-height);
		background: var(--color-card);
		border-top: 1px solid var(--color-border);
	}

	.tabs {
		max-width: var(--content-max);
		height: 100%;
		margin: 0 auto;
		display: grid;
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: var(--touch-target);
		min-width: 0;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		font-weight: 500;
		text-align: center;
	}

	.tab i {
		font-size: 1.125rem;
	}

	.tab[aria-current='page'] {
		color: var(--color-accent);
		font-weight: 600;
	}

	.tab:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: -4px;
		border-radius: var(--radius-control);
	}

	@media (max-width: 400px) {
		.tab {
			font-size: 0.7rem;
		}

		.tab i {
			font-size: 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.theme-toggle {
			transition: none;
		}
	}
</style>
