<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import LoginModal from '#lib/LoginModal.svelte';
	import { store } from '#lib/store.svelte.js';
	import {
		EVENTS,
		ANNOUNCEMENTS,
		formatValue,
		formatDate,
		nextSession,
		sessionTimeLabel,
		untilLabel
	} from '#lib/events.js';

	//login script
	let { form, data } = $props();
	let showLoginModal = $state(false);

	//time tracking algorithm
	let time = $state(new Date());

	const hours = $derived(String(time.getHours()).padStart(2, '0'));
	const minutes = $derived(String(time.getMinutes()).padStart(2, '0'));
	const seconds = $derived(String(time.getSeconds()).padStart(2, '0'));
	//if statement for morning afternoon evening on main page
	const greeting = $derived(
		parseInt(hours, 10) < 12 ? 'Morning' : parseInt(hours, 10) < 18 ? 'Afternoon' : 'Evening'
	);

	onMount(() => {
		const interval = setInterval(() => {
			time = new Date();
		}, 1000);

		return () => clearInterval(interval);
	});

	const session = $derived(nextSession(data.sessions, time));
	const attended = $derived(session ? store.isAttended(session.key) : false);
	const progress = $derived(Math.min(100, (store.composite / store.target) * 100));
</script>

<header class="row">
	<h2 class="brand">FormUp</h2>
	{#if data.user}
		<form method="POST" action="?/logout" use:enhance>
			<button class="btn ghost">Log out</button>
		</form>
	{:else}
		<button class="btn ghost" onclick={() => (showLoginModal = true)}>Log In</button>
	{/if}
</header>

<LoginModal bind:open={showLoginModal} {form} />

<section class="welcome-title">
	<h1>Good {greeting}{data.username ? `, ${data.username}` : ''}</h1>
	<p class="muted">Current Time: {hours}:{minutes}:{seconds}</p>
</section>

<section class="card stack">
	<div class="row">
		<p class="section-label">Today's PT</p>
		{#if session}
			<span class="pill">{untilLabel(session.start, time)}</span>
		{/if}
	</div>
	{#if session}
		<div>
			<h2>{sessionTimeLabel(session.start)}</h2>
			<p>{session.title}: {session.detail}</p>
		</div>
		<button
			class="btn"
			class:done={attended}
			aria-pressed={attended}
			onclick={() => store.toggleAttended(session.key)}
		>
			{attended ? 'Attended ✓' : 'Mark attended'}
		</button>
	{:else}
		<h2>No session scheduled</h2>
	{/if}
</section>

<section class="card stack">
	<div class="row">
		<p class="section-label">PFA record</p>
		<p class="muted">Target {store.target}</p>
	</div>
	<div class="row score">
		<p class="stat">{store.composite.toFixed(1)}</p>
		{#if store.delta !== null}
			<p class:positive={store.delta >= 0} class:muted={store.delta < 0}>
				{store.delta >= 0 ? 'Up' : 'Down'}
				{Math.abs(store.delta).toFixed(1)} pts since last attempt
			</p>
		{/if}
	</div>
	<div
		class="bar"
		role="progressbar"
		aria-label="Progress toward target score"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={Math.round(progress)}
	>
		<span style="width: {progress}%"></span>
	</div>

	{#if store.latest}
		<ul class="events">
			{#each EVENTS as ev}
				<li class="row">
					<span class="muted">{ev.label}</span>
					<span class="value">{formatValue(ev, store.latest.results[ev.id])}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">Record an assessment on the Progress tab to see your results here.</p>
	{/if}
</section>

<section class="card stack">
	<p class="section-label">Announcements</p>
	{#each ANNOUNCEMENTS as group}
		<div>
			<h3>{formatDate(group.date)}</h3>
			<ul class="plain">
				{#each group.items as item}
					<li>{item}</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>

<style>
	.brand {
		color: var(--color-accent);
	}

	.pill {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.score {
		align-items: baseline;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.events {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.value {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
	}

	.plain {
		margin-top: var(--space-2);
		color: var(--color-text-muted);
	}
</style>
