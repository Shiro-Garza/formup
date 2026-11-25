<script>
	import { store } from '#lib/store.svelte.js';
	import Chart from '#lib/Chart.svelte';
	import {
		EVENTS,
		eventById,
		eventScore,
		formatValue,
		formatDate,
		parseTime,
		todayISO
	} from '#lib/events.js';

	let selected = $state('run');
	const ev = $derived(eventById(selected));

	const points = $derived(
		store.attempts.map((a) => ({ label: formatDate(a.date), value: a.results[selected] }))
	);

	// Standings from the latest attempt; the lowest score is the weakest event.
	const standings = $derived(
		store.latest
			? EVENTS.map((e) => {
					const values = store.attempts.map((a) => a.results[e.id]);
					const best = e.better === 'lower' ? Math.min(...values) : Math.max(...values);
					return {
						event: e,
						value: store.latest.results[e.id],
						score: eventScore(e, store.latest.results[e.id]),
						best
					};
				})
			: []
	);
	const weakestId = $derived(
		standings.length ? standings.reduce((a, b) => (b.score < a.score ? b : a)).event.id : null
	);

	// Record an attempt
	let attemptDate = $state(todayISO());
	let inputs = $state({ run: '', pushups: '', plank: '' });
	let error = $state('');

	function recordAttempt(e) {
		e.preventDefault();
		error = '';
		const results = {};
		for (const event of EVENTS) {
			const raw = inputs[event.id];
			const v = event.kind === 'time' ? parseTime(raw) : Number(raw);
			if (!(v > 0)) return (error = `Enter a result for ${event.label}.`);
			results[event.id] = v;
		}
		store.addAttempt({ date: attemptDate, results });
		inputs = { run: '', pushups: '', plank: '' };
	}

	function onTarget(e) {
		const n = Number(e.currentTarget.value);
		if (n > 0 && n <= 100) store.setTarget(n);
	}
</script>

<h1>Progress</h1>

<section class="card stack">
	<div class="chips" role="group" aria-label="Assessment event">
		{#each EVENTS as e}
			<button class="chip" aria-pressed={selected === e.id} onclick={() => (selected = e.id)}>
				{e.label}
			</button>
		{/each}
	</div>

	<Chart
		{points}
		goal={ev.best}
		better={ev.better}
		format={(v) => formatValue(ev, v)}
		label="{ev.label} results over time with goal line"
	/>
</section>

<section class="card stack">
	<p class="section-label">Standings</p>
	{#each standings as s (s.event.id)}
		<div class="standing" class:weakest={s.event.id === weakestId}>
			<div class="row">
				<span>{s.event.label}</span>
				<span class="value">{formatValue(s.event, s.value)}</span>
			</div>
			<div class="bar" aria-hidden="true"><span style="width: {s.score}%"></span></div>
			<p class="muted small">
				{s.score.toFixed(0)} pts · Best {formatValue(s.event, s.best)}
			</p>
			{#if s.event.id === weakestId}
				<p class="focus"><strong>Weakest.</strong> {s.event.focus}</p>
			{/if}
		</div>
	{:else}
		<p class="muted">No assessment attempts yet.</p>
	{/each}
</section>

<form class="card stack" onsubmit={recordAttempt}>
	<p class="section-label">Record an assessment attempt</p>

	<div class="field">
		<label for="attempt-date">Date</label>
		<input id="attempt-date" type="date" bind:value={attemptDate} required />
	</div>

	{#each EVENTS as e}
		<div class="field">
			<label for="in-{e.id}">{e.label}{e.kind === 'time' ? ' (m:ss)' : ' (reps)'}</label>
			<input id="in-{e.id}" inputmode="numeric" bind:value={inputs[e.id]} />
		</div>
	{/each}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button class="btn" type="submit">Save attempt</button>
</form>

<section class="card stack">
	<div class="field">
		<label for="target">Target composite score (1 to 100)</label>
		<input id="target" type="number" min="1" max="100" value={store.target} onchange={onTarget} />
	</div>
</section>

<style>
	.standing {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
	}

	.standing.weakest {
		border-color: var(--color-accent);
	}

	.value {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
	}

	.small {
		font-size: 0.875rem;
	}

	.focus {
		color: var(--color-accent);
		font-size: 0.9rem;
	}
</style>
