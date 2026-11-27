<script>
	import {
		formatDate,
		nextSession,
		untilLabel,
		todayISO
	} from '#lib/events.js';

	let { data } = $props();

	const today = todayISO();

	const upcoming = $derived(
		[...data.sessions]
			.filter((s) => s.date >= today)
			.sort((a, b) =>
				`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
			)
	);

	const next = $derived(nextSession(upcoming));

	function weekday(date) {
		return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
			weekday: 'short'
		});
	}

	function month(date) {
		return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
			month: 'short'
		});
	}
</script>

<h1>PT Schedule</h1>

<p class="muted">
	View your upcoming physical training sessions.
</p>

{#if next}
	<section class="card stack">
		<div class="row">
			<p class="section-label">Next session</p>
			<span class="pill">{untilLabel(next.start)}</span>
		</div>

		<h2 class="session-title">{next.title}</h2>

		<div class="row">
			<span class="muted">Date</span>
			<strong>{weekday(next.date)}, {formatDate(next.date)}</strong>
		</div>

		<div class="row">
			<span class="muted">Start time</span>
			<strong>{next.time.replace(':', '')}</strong>
		</div>

		<div class="row location-row">
			<span class="muted">Location</span>
			<strong>{next.location || 'To be announced'}</strong>
		</div>

		{#if next.detail}
			<p class="muted">{next.detail}</p>
		{/if}
	</section>
{/if}

<section class="card stack">
	<div class="row">
		<p class="section-label">Upcoming sessions</p>
		<span class="muted">{upcoming.length} scheduled</span>
	</div>

	{#each upcoming as session (session.id)}
		<article class="session">
			<div class="date-box">
				<span class="muted">{weekday(session.date)}</span>
				<span class="day">{session.date.slice(-2)}</span>
				<span class="muted">{month(session.date)}</span>
			</div>

			<div class="session-info">
				<h3>{session.title}</h3>

				<p class="session-time">
					{session.time.replace(':', '')}
				</p>

				<p class="session-location">
					<svg
						width="18"
						height="18"
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
				</p>

				{#if session.detail}
					<p class="muted">{session.detail}</p>
				{/if}
			</div>
		</article>
	{:else}
		<p class="muted">No upcoming PT sessions scheduled.</p>
	{/each}
</section>

<style>
	.session-title {
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

	.session {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.session:last-child {
		border-bottom: 0;
	}

	.date-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-width: 64px;
		padding: var(--space-2);
		background: var(--color-bg);
		border-radius: var(--radius-control);
		font-size: 0.8rem;
	}

	.day {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--color-accent);
	}

	.session-info {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.session-time {
		color: var(--color-accent);
		font-weight: 600;
		margin: var(--space-1) 0;
	}

	.session-location {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-text);
		font-size: 0.875rem;
		margin-bottom: var(--space-2);
	}

	.session-location svg {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--color-accent);
	}

	.location-row {
		align-items: flex-start;
	}

	.location-row strong {
		min-width: 0;
		text-align: right;
		overflow-wrap: anywhere;
	}
</style>
