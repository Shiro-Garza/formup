
<script>
	import { store } from '#lib/store.svelte.js';
	import {
		ACTIVITIES,
		activityById,
		parseTime,
		todayISO,
		formatDate,
		workoutLabel,
		workoutValue
	} from '#lib/events.js';

	let activity = $state('run');
	let date = $state(todayISO());
	let distance = $state('');
	let time = $state('');
	let reps = $state('');
	let effort = $state(3);
	let note = $state('');
	let error = $state('');
	let saved = $state(false);
	let saving = $state(false);

	const fields = $derived(activityById(activity).fields);

	async function save(e) {
		e.preventDefault();

		if (saving || store.savingWorkout) return;

		error = '';
		const workout = { date, activity, effort, note: note.trim() };

		if (fields.includes('distance')) {
			const d = Number(distance);
			if (!(d > 0)) return (error = 'Enter a distance in miles.');
			workout.distance = d;
		}

		if (fields.includes('time')) {
			const seconds = parseTime(time);
			if (!seconds) return (error = 'Enter time as m:ss, like 18:45.');
			workout.seconds = seconds;
		}

		if (fields.includes('reps')) {
			const r = Number(reps);
			if (!(Number.isInteger(r) && r > 0)) return (error = 'Enter the number of reps.');
			workout.reps = r;
		}

		saving = true;

		try {
			const ok = await store.submitWorkout(workout);

			if (!ok) {
				error =
					store.workoutError ||
					'Unable to save the workout.';
				return;
			}

			distance = time = reps = note = '';
			saved = true;
			setTimeout(() => (saved = false), 2000);

		} catch (err) {
			error =
				err instanceof Error
					? err.message
					: 'Unable to save the workout.';

		} finally {
			saving = false;
		}
	}
</script>

<!-- Page Header -->
<div class="page-header">
	<h1>Log Workout</h1>
	<p>Record your workouts, track your effort, and keep a history of your training.</p>
</div>

{#if store.isCadet && store.workoutError}
	<p class="error" role="alert">{store.workoutError}</p>
{/if}

<!-- Workout Form -->
<form class="card stack" onsubmit={save}>
	<fieldset class="field">
		<legend>Activity</legend>
		<div class="chips">
			{#each ACTIVITIES as a}
				<button
					type="button"
					class="chip"
					aria-pressed={activity === a.id}
					onclick={() => (activity = a.id)}
				>
					{a.label}
				</button>
			{/each}
		</div>
	</fieldset>

	<div class="field">
		<label for="date">Date</label>
		<input id="date" type="date" bind:value={date} required />
	</div>

	{#if fields.includes('distance')}
		<div class="field">
			<label for="distance">Distance (miles)</label>
			<input id="distance" inputmode="decimal" placeholder="2" bind:value={distance} />
		</div>
	{/if}

	{#if fields.includes('time')}
		<div class="field">
			<label for="time">Time (m:ss)</label>
			<input id="time" inputmode="numeric" placeholder="18:45" bind:value={time} />
		</div>
	{/if}

	{#if fields.includes('reps')}
		<div class="field">
			<label for="reps">Reps</label>
			<input id="reps" inputmode="numeric" placeholder="40" bind:value={reps} />
		</div>
	{/if}

	<fieldset class="field">
		<legend>Effort (1 to 5)</legend>
		<div class="chips">
			{#each [1, 2, 3, 4, 5] as n}
				<button
					type="button"
					class="chip"
					aria-pressed={effort === n}
					onclick={() => (effort = n)}
				>
					{n}
				</button>
			{/each}
		</div>
	</fieldset>

	<div class="field">
		<label for="note">Note</label>
		<textarea
			id="note"
			rows="2"
			placeholder="Felt strong today."
			bind:value={note}
		></textarea>
	</div>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<button class="btn" type="submit" disabled={saving || store.savingWorkout}>
		{saving || store.savingWorkout
			? 'Saving...'
			: saved
				? 'Saved ✓'
				: 'Save workout'}
	</button>
</form>

<!-- Recent Workouts -->
<section class="card stack">
	<p class="section-label">Recent workouts</p>

	{#if store.workouts.length === 0}
		<p class="muted">No workouts logged yet.</p>
	{:else}
		<ul>
			{#each store.workouts.slice(0, 8) as w (w.id)}
				<li class="workout">
					<div class="row">
						<span class="muted date">{formatDate(w.date)}</span>
						<span class="grow">{workoutLabel(w)}</span>
						<span class="value">{workoutValue(w)}</span>
						<button
							class="del"
							aria-label="Delete {workoutLabel(w)} on {formatDate(w.date)}"
							onclick={() => store.deleteWorkout(w.id)}
						>
							&times;
						</button>
					</div>

					{#if w.effort || w.note}
						<p class="muted meta">
							{#if w.effort}
								<span>Effort {w.effort}/5</span>
							{/if}

							{#if w.effort && w.note}
								<span> · </span>
							{/if}

							{#if w.note}
								<span>{w.note}</span>
							{/if}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	/* Page Header */

	.page-header {
		background: #17365d;
		padding: 32px;
		border-radius: 12px;
		margin-bottom: 24px;
	}

	.page-header h1 {
		color: #ffffff;
		margin: 0 0 12px;
		font-family: var(--font-display);
	}

	.page-header p {
		color: #c5d8f0;
		margin: 0;
	}

	/* Recent Workouts */

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	li {
		min-height: var(--touch-target);
	}

	.workout {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.workout:last-child {
		border-bottom: 0;
	}

	.meta {
		padding-left: 3.5rem;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}

	.date {
		width: 3.5rem;
	}

	.grow {
		flex: 1;
	}

	.value {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
	}

	.del {
		min-width: var(--touch-target);
		min-height: var(--touch-target);
		border: 0;
		background: none;
		color: var(--color-text-muted);
		font-size: 1.5rem;
	}

	.del:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
