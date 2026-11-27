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
		untilLabel,
		todayISO
	} from '#lib/events.js';

	let { form, data } = $props();
	let showLoginModal = $state(false);

	// Time tracking
	let time = $state(new Date());

	const hours = $derived(String(time.getHours()).padStart(2, '0'));
	const minutes = $derived(String(time.getMinutes()).padStart(2, '0'));
	const seconds = $derived(String(time.getSeconds()).padStart(2, '0'));

	const greeting = $derived(
		parseInt(hours, 10) < 12
			? 'Morning'
			: parseInt(hours, 10) < 18
				? 'Afternoon'
				: 'Evening'
	);

	onMount(() => {
		const interval = setInterval(() => {
			time = new Date();
		}, 1000);

		return () => clearInterval(interval);
	});

	// PT session information
	const session = $derived(nextSession(data.sessions, time));

	const ptHeading = $derived(
		session
			? session.date === todayISO(time)
				? "Today's PT"
				: 'Upcoming PT'
			: 'PT Schedule'
	);

	// Attendance management
	let attendance = $state([]);
	let attendanceLoading = $state(false);
	let attendanceSaving = $state(false);
	let attendanceError = $state('');
	let attendanceSuccess = $state('');

	const isCadet = $derived(
		!!data.user && data.user.role !== 'admin'
	);

	const attended = $derived(
		session
			? attendance.some((a) => a.sessionId === session.id)
			: false
	);

	const attendanceOpens = $derived(
		session
			? session.start.getTime() - 15 * 60 * 1000
			: 0
	);

	const attendanceCloses = $derived(
		session
			? session.start.getTime() + 120 * 60 * 1000
			: 0
	);

	const canAttend = $derived(
		isCadet &&
		!!session &&
		!attended &&
		time.getTime() >= attendanceOpens &&
		time.getTime() <= attendanceCloses
	);

	// Reload attendance whenever the authenticated account changes.
	$effect(() => {
		const user = data.user;
		const controller = new AbortController();

		attendance = [];
		attendanceError = '';
		attendanceSuccess = '';
		attendanceLoading = false;
		attendanceSaving = false;

		if (user && user.role !== 'admin') {
			loadAttendance(controller.signal);
		}

		return () => controller.abort();
	});

	async function loadAttendance(signal) {
		attendanceLoading = true;
		attendanceError = '';

		try {
			const response = await fetch('/api/attendance', {
				signal
			});

			if (!response.ok) {
				throw new Error('Unable to load attendance.');
			}

			const result = await response.json();

			if (!signal.aborted) {
				attendance = result.attendance ?? [];
			}
		} catch (err) {
			if (!signal.aborted) {
				attendanceError = 'Unable to load attendance. Refresh to try again.';
			}
		} finally {
			if (!signal.aborted) {
				attendanceLoading = false;
			}
		}
	}

	async function markAttendance() {
		if (!data.user) {
			showLoginModal = true;
			return;
		}

		if (!canAttend || attendanceSaving || attendanceLoading) {
			return;
		}

		const sessionId = session.id;
		const accountEmail = data.user.email;

		attendanceSaving = true;
		attendanceError = '';
		attendanceSuccess = '';

		try {
			const response = await fetch('/api/attendance', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					sessionId
				})
			});

			const result = await response.json().catch(() => null);

			// Ignore the response if the active account changed.
			if (data.user?.email !== accountEmail) return;

			if (!response.ok) {
				throw new Error(
					result?.message || 'Unable to record attendance.'
				);
			}

			if (!attendance.some((a) => a.sessionId === sessionId)) {
				attendance = [
					...attendance,
					{
						sessionId
					}
				];
			}

			attendanceSuccess =
				result?.message || 'Attendance recorded successfully.';
		} catch (err) {
			if (data.user?.email === accountEmail) {
				attendanceError =
					err.message || 'Something went wrong. Please try again.';
			}
		} finally {
			if (data.user?.email === accountEmail) {
				attendanceSaving = false;
			}
		}
	}

	// PFA progress
	const progress = $derived(
		Math.min(100, (store.composite / store.target) * 100)
	);
</script>

<header class="row">
	<h2 class="brand">FormUp</h2>

	{#if data.user}
		<form method="POST" action="?/logout" use:enhance>
			<button class="btn ghost">Log out</button>
		</form>
	{:else}
		<button
			class="btn ghost"
			onclick={() => (showLoginModal = true)}
		>
			Log In
		</button>
	{/if}
</header>

<LoginModal bind:open={showLoginModal} {form} />

<section class="welcome-title">
	<h1>Good {greeting}{data.username ? `, ${data.username}` : ''}</h1>
	<p class="muted">Current Time: {hours}:{minutes}:{seconds}</p>
</section>

<!-- PT Session Card -->
<section class="card stack">
	<div class="row">
		<p class="section-label">{ptHeading}</p>

		{#if session}
			<span class="pill">
				{untilLabel(session.start, time)}
			</span>
		{/if}
	</div>

	{#if session}
		<div class="session-info">
			<h2>{sessionTimeLabel(session.start)}</h2>

			<p>
				{session.title}{session.detail ? `: ${session.detail}` : ''}
			</p>
		</div>

		<div class="session-location">
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
				<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
				<circle cx="12" cy="10" r="3" />
			</svg>

			<span>
				{session.location || 'Location to be announced'}
			</span>
		</div>

		<!-- Attendance controls -->
		{#if !data.user}
			<button
				class="btn"
				onclick={() => (showLoginModal = true)}
			>
				Log in to mark attendance
			</button>

		{:else if data.user.role === 'admin'}
			<p class="attendance-hint muted">
				Administrator account — cadet check-in is unavailable.
			</p>

		{:else if attendanceLoading}
			<button class="btn ghost" disabled>
				Loading attendance...
			</button>

		{:else if attended}
			<button class="btn done" disabled>
				Attendance recorded ✓
			</button>

		{:else if time.getTime() < attendanceOpens}
			<button class="btn ghost locked" disabled>
				Attendance not open yet
			</button>

			<p class="attendance-hint muted">
				Check-in opens 15 minutes before PT.
			</p>

		{:else if time.getTime() > attendanceCloses}
			<button class="btn ghost locked" disabled>
				Attendance closed
			</button>

		{:else}
			<button
				class="btn"
				onclick={markAttendance}
				disabled={!canAttend || attendanceSaving}
			>
				{attendanceSaving ? 'Recording...' : 'Mark attended'}
			</button>

			<p class="attendance-hint muted">
				Check-in is currently available.
			</p>
		{/if}

		{#if attendanceError}
			<p class="error" role="alert">
				{attendanceError}
			</p>
		{/if}

		{#if attendanceSuccess}
			<p class="positive attendance-hint" role="status">
				{attendanceSuccess}
			</p>
		{/if}

	{:else}
		<h2>No session scheduled</h2>
		<p class="muted">Check the schedule for future PT sessions.</p>
	{/if}

	<a href="/schedule" class="btn ghost schedule-link">
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
			<rect x="3" y="5" width="18" height="16" rx="2" />
			<path d="M16 3v4M8 3v4M3 10h18" />
		</svg>

		View full PT schedule
	</a>
</section>

<!-- PFA Record Card -->
<section class="card stack">
	<div class="row">
		<p class="section-label">PFA record</p>
		<p class="muted">Target {store.target}</p>
	</div>

	<div class="row score">
		<p class="stat">{store.composite.toFixed(1)}</p>

		{#if store.delta !== null}
			<p
				class:positive={store.delta >= 0}
				class:muted={store.delta < 0}
			>
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

					<span class="value">
						{formatValue(ev, store.latest.results[ev.id])}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">
			Record an assessment on the Progress tab to see your results here.
		</p>
	{/if}
</section>

<!-- Announcements -->
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

	.session-info {
		overflow-wrap: anywhere;
	}

	.session-location {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-text-muted);
		overflow-wrap: anywhere;
	}

	.session-location svg {
		flex-shrink: 0;
		color: var(--color-accent);
		margin-top: 2px;
	}

	.session-location span {
		min-width: 0;
	}

	.attendance-hint {
		font-size: 0.875rem;
		text-align: center;
	}

	.locked {
		color: var(--color-text-muted);
		cursor: not-allowed;
	}

	button:disabled {
		cursor: not-allowed;
	}

	.btn.done {
		opacity: 1;
	}

	.schedule-link {
		gap: var(--space-2);
		text-align: center;
	}

	.schedule-link svg {
		flex-shrink: 0;
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
