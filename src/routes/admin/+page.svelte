<script>
	import { enhance } from '$app/forms';
	import {
		EVENTS,
		compositeScore,
		formatValue,
		formatDate,
		todayISO
	} from '#lib/events.js';

	let { data, form } = $props();

	const today = todayISO();
	const upcoming = $derived(data.sessions.filter((s) => s.date >= today));

	const rows = $derived(
		data.roster.map((r) => {
			const latest = r.attempts.at(-1) ?? null;
			return { ...r, latest, composite: latest ? compositeScore(latest.results) : null };
		})
	);
</script>

<h1>Admin</h1>

<form class="card stack" method="POST" action="?/addSession" use:enhance>
	<p class="section-label">Schedule a PT session</p>

	<div class="field">
		<label for="s-title">Title</label>
		<input id="s-title" name="title" placeholder="Run Day" required />
	</div>

	<div class="two">
		<div class="field">
			<label for="s-date">Date</label>
			<input id="s-date" name="date" type="date" min={today} required />
		</div>
		<div class="field">
			<label for="s-time">Start time</label>
			<input id="s-time" name="time" type="time" value="06:00" required />
		</div>
	</div>

	<div class="field">
		<label for="s-detail">Details</label>
		<input id="s-detail" name="detail" placeholder="1 minute sprints, 1:30 walk" />
	</div>

	{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
	<button class="btn" type="submit">Add session</button>
</form>

<section class="card stack">
	<p class="section-label">Upcoming sessions</p>
	{#each upcoming as s (s.id)}
		<div class="row session">
			<div>
				<strong>{formatDate(s.date)} · {s.time.replace(':', '')}</strong>
				<p class="muted">{s.title}{s.detail ? `: ${s.detail}` : ''}</p>
			</div>
			<form method="POST" action="?/deleteSession" use:enhance>
				<input type="hidden" name="id" value={s.id} />
				<button class="btn ghost" aria-label="Delete {s.title} on {formatDate(s.date)}">Delete</button>
			</form>
		</div>
	{:else}
		<p class="muted">No upcoming sessions.</p>
	{/each}
</section>

<section class="card stack">
	<p class="section-label">PFA scores by cadet</p>

	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th>Cadet</th>
					{#each EVENTS as e}<th>{e.label}</th>{/each}
					<th>Composite</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.email)}
					<tr>
						<td>
							{r.name}
							<span class="muted small">{r.email}</span>
						</td>
						{#if r.latest}
							{#each EVENTS as e}
								<td>{formatValue(e, r.latest.results[e.id])}</td>
							{/each}
							<td class="stat-cell">{r.composite.toFixed(1)}</td>
						{:else}
							<td class="muted" colspan="4">No attempts yet</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#each rows.filter((r) => r.attempts.length > 1) as r (r.email)}
		<details>
			<summary>{r.name}: all {r.attempts.length} attempts</summary>
			<ul>
				{#each [...r.attempts].reverse() as a (a.id)}
					<li class="row">
						<span class="muted">{formatDate(a.date)}</span>
						<span>
							{EVENTS.map((e) => formatValue(e, a.results[e.id])).join(' · ')}
						</span>
						<span class="stat-cell">{compositeScore(a.results).toFixed(1)}</span>
					</li>
				{/each}
			</ul>
		</details>
	{/each}
</section>

<style>
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	.session {
		align-items: flex-start;
	}

	.scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		padding: var(--space-3) var(--space-2);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
	}

	th {
		color: var(--color-text-muted);
		font-weight: 500;
		white-space: nowrap;
	}

	.small {
		display: block;
		font-size: 0.75rem;
	}

	.stat-cell {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-accent);
	}

	summary {
		min-height: var(--touch-target);
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: var(--space-2) 0;
	}
</style>
