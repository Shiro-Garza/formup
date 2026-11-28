
<script>
	import { store } from '#lib/store.svelte.js';
	import Chart from '#lib/Chart.svelte';
	import {
		ACTIVITIES,
		EVENTS,
		activityById,
		compositeScore,
		eventById,
		eventScore,
		formatTime,
		formatValue,
		formatDate,
		parseTime,
		todayISO
	} from '#lib/events.js';

	let { data } = $props();

	// Chart event selection.
	let selected = $state('run');

	const ev = $derived(eventById(selected));

	const points = $derived(
		store.attempts
			.filter((a) => Number(a.results[selected]) > 0)
			.map((a) => ({
				label: formatDate(a.date),
				value: Number(a.results[selected])
			}))
	);

	// Chart event selection for logged workouts.
	let workoutActivity = $state('run');

	const workoutEvent = $derived(eventById(workoutActivity));

	const workoutPoints = $derived(
		[...store.workouts]
			.filter((w) => w.activity === workoutActivity)
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((w) => ({
				label: formatDate(w.date),
				value: workoutMetric(w)
			}))
	);

	// Runs are compared by pace per mile; other events by their raw result.
	const workoutGoal = $derived(
		workoutActivity === 'run'
			? Math.round(workoutEvent.best / 2)
			: workoutEvent?.best ?? null
	);

	function workoutMetric(w) {
		if (w.activity === 'run') {
			const distance = Number(w.distance) || 0;

			return distance > 0
				? w.seconds / distance
				: w.seconds;
		}

		if (w.activity === 'plank') return w.seconds;

		return w.reps;
	}

	function workoutFormat(value) {
		if (workoutActivity === 'run') {
			return `${formatTime(Math.round(value))}/mi`;
		}

		if (workoutActivity === 'plank') {
			return formatTime(Math.round(value));
		}

		return `${Math.round(value)} reps`;
	}

	// Calculate standings from the latest assessment.
	const standings = $derived(
		store.latest
			? EVENTS.map((e) => {
				// Ignore legacy records that predate this event.
				const values = store.attempts
					.map((a) => Number(a.results[e.id]))
					.filter((v) => Number.isFinite(v) && v > 0);

				const best = values.length
					? e.better === 'lower'
						? Math.min(...values)
						: Math.max(...values)
					: null;

				const value = Number(
					store.latest.results[e.id]
				);

				return {
					event: e,
					value,
					score:
						Number.isFinite(value) && value > 0
							? eventScore(e, value)
							: 0,
					best
				};
			})
			: []
	);

	// Identify the weakest event.
	const weakestId = $derived(
		standings.length
			? standings.reduce(
				(a, b) => b.score < a.score ? b : a
			).event.id
			: null
	);

	// Assessment form state.
	let attemptDate = $state(todayISO());

	// Assessment currently being edited, if any.
	let editingId = $state(null);

	let inputs = $state({
		run: '',
		pushups: '',
		situps: ''
	});

	let error = $state('');
	let success = $state('');
	let submitting = $state(false);

	const isAdmin = $derived(
		data.user?.role === 'admin'
	);

	const isCadet = $derived(
		!!data.user && data.user.role !== 'admin'
	);

	const accountReady = $derived(
		store.initialized &&
		store.activeAccount === store.getAccountKey(data.user)
	);

	// Clear form feedback when switching accounts.
	$effect(() => {
		const account = data.user?.email;

		editingId = null;
		attemptDate = todayISO();

		inputs = {
			run: '',
			pushups: '',
			situps: ''
		};

		error = '';
		success = '';
		submitting = false;
	});

	// Record an assessment.
	async function recordAttempt(e) {
		e.preventDefault();

		if (
			submitting ||
			store.savingAttempt ||
			store.syncing ||
			!accountReady
		) {
			return;
		}

		error = '';
		success = '';

		if (isAdmin) {
			error =
				'Administrators cannot submit cadet assessments.';
			return;
		}

		// Validate the assessment date.
		if (
			typeof attemptDate !== 'string' ||
			!/^\d{4}-\d{2}-\d{2}$/.test(attemptDate)
		) {
			error = 'Enter a valid assessment date.';
			return;
		}

		const parsedDate = new Date(
			`${attemptDate}T00:00:00Z`
		);

		if (
			Number.isNaN(parsedDate.getTime()) ||
			parsedDate.toISOString().slice(0, 10) !== attemptDate
		) {
			error = 'Enter a valid assessment date.';
			return;
		}

		if (attemptDate > todayISO()) {
			error =
				'Assessment dates cannot be in the future.';
			return;
		}

		// Validate individual event results.
		const results = {};

		for (const event of EVENTS) {
			const raw = String(
				inputs[event.id] ?? ''
			).trim();

			if (!raw) {
				error =
					`Enter a result for ${event.label}.`;
				return;
			}

			const value =
				event.kind === 'time'
					? parseTime(raw)
					: Number(raw);

			if (
				!Number.isFinite(value) ||
				value <= 0 ||
				value > 100000
			) {
				error =
					`Enter a valid result for ${event.label}.`;
				return;
			}

			if (
				event.kind !== 'time' &&
				!Number.isInteger(value)
			) {
				error =
					`${event.label} must be a whole number.`;
				return;
			}

			results[event.id] = value;
		}

		const account = store.activeAccount;
		const version = store.accountVersion;
		const wasEditing = editingId;

		submitting = true;

		try {
			// Editing updates the existing record; otherwise a new
			// assessment is created (server-side for cadets).
			const saved = wasEditing
				? await store.updateAttempt(wasEditing, {
						date: attemptDate,
						results
					})
				: await store.submitAttempt({
						date: attemptDate,
						results
					});

			// Ignore responses from a previous account.
			if (
				store.activeAccount !== account ||
				store.accountVersion !== version
			) {
				return;
			}

			if (!saved) {
				error =
					'Assessment could not be saved.';
				return;
			}

			// Clear the form only after a successful save.
			inputs = {
				run: '',
				pushups: '',
				situps: ''
			};

			editingId = null;

			success = wasEditing
				? 'Assessment updated successfully.'
				: isCadet
					? 'Assessment saved and synchronized successfully.'
					: 'Assessment saved on this device.';

		} catch (err) {
			if (
				store.activeAccount === account &&
				store.accountVersion === version
			) {
				error =
					err instanceof Error
						? err.message
						: 'Unable to save the assessment.';
			}

		} finally {
			if (
				store.activeAccount === account &&
				store.accountVersion === version
			) {
				submitting = false;
			}
		}
	}

	// Load a saved assessment into the form for editing.
	function startEdit(attempt) {
		editingId = attempt.id;
		attemptDate = attempt.date;

		inputs = Object.fromEntries(
			EVENTS.map((event) => [
				event.id,
				event.kind === 'time'
					? formatValue(
							event,
							attempt.results[event.id]
						)
					: String(attempt.results[event.id])
			])
		);

		error = '';
		success = '';
	}

	// Leave editing mode and clear the form.
	function cancelEdit() {
		editingId = null;
		attemptDate = todayISO();

		inputs = {
			run: '',
			pushups: '',
			situps: ''
		};

		error = '';
		success = '';
	}

	// Delete a saved assessment after confirmation.
	async function removeAttempt(attempt) {
		if (
			!window.confirm(
				`Delete the assessment from ${formatDate(attempt.date)}?`
			)
		) {
			return;
		}

		error = '';

		try {
			const removed = await store.deleteAttempt(
				attempt.id
			);

			if (removed) {
				if (editingId === attempt.id) {
					cancelEdit();
				}

				success = 'Assessment deleted.';
			} else {
				error =
					store.syncError ||
					'Unable to delete the assessment.';
			}

		} catch (err) {
			error =
				err instanceof Error
					? err.message
					: 'Unable to delete the assessment.';
		}
	}

	// Update the personal fitness target.
	function onTarget(e) {
		const value = Number(
			e.currentTarget.value
		);

		if (
			accountReady &&
			Number.isFinite(value) &&
			value >= 1 &&
			value <= 100
		) {
			store.setTarget(value);
		} else {
			e.currentTarget.value = String(
				store.target
			);
		}
	}
</script>

<!-- Page Header -->
<div class="page-header">
	<h1>Progress</h1>
	<p>
		Track your fitness performance, assessment scores, and improvement over time.
	</p>
</div>

<!-- Server synchronization feedback -->
{#if isCadet}
	<section
		class="card sync-panel"
		aria-label="Assessment synchronization"
	>
		{#if !accountReady || store.syncing}

			<div class="sync-status" role="status">
				<span class="spinner" aria-hidden="true"></span>

				<div>
					<strong>Synchronizing assessments...</strong>

					<p class="muted small">
						Retrieving your latest PFA records.
					</p>
				</div>
			</div>

		{:else if store.syncError}

			<div class="sync-error">
				<p class="error" role="alert">
					{store.syncError}
				</p>

				<button
					type="button"
					class="btn ghost"
					onclick={() => store.syncAttempts()}
					disabled={store.savingAttempt}
				>
					Retry synchronization
				</button>
			</div>

		{:else}

			<div class="sync-status">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="positive"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="m8 12 3 3 5-6" />
				</svg>

				<div>
					<strong class="positive">
						Assessments synchronized
					</strong>

					<p class="muted small">
						{store.attempts.length}
						{store.attempts.length === 1
							? 'assessment'
							: 'assessments'}
						available from the server.
					</p>
				</div>
			</div>

		{/if}
	</section>
{/if}

<!-- Assessment progress chart -->
<section class="card stack">
	<div
		class="chips"
		role="group"
		aria-label="Assessment event"
	>
		{#each EVENTS as e}
			<button
				class="chip"
				aria-pressed={selected === e.id}
				onclick={() => (selected = e.id)}
			>
				{e.label}
			</button>
		{/each}
	</div>

	{#if !accountReady || store.syncing}

		<div class="empty-state">
			<span class="spinner" aria-hidden="true"></span>

			<p class="muted">
				Loading assessment results...
			</p>
		</div>

	{:else if points.length}

		<Chart
			{points}
			goal={ev.best}
			better={ev.better}
			format={(v) => formatValue(ev, v)}
			label={`${ev.label} results over time with goal line`}
		/>

	{:else}

		<div class="empty-state">
			<svg
				width="40"
				height="40"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M3 3v18h18" />
				<path d="m7 14 4-4 4 4 6-7" />
			</svg>

			<h3>
				{store.syncError
					? 'Assessment history unavailable'
					: 'No assessment history yet'}
			</h3>

			<p class="muted">
				{store.syncError
					? 'Retry synchronization to retrieve your results.'
					: isAdmin
						? 'View cadet assessment results on the Admin page.'
						: 'Record an assessment to begin tracking your fitness progress.'}
			</p>
		</div>

	{/if}
</section>

<!-- Logged workout chart -->
<section class="card stack">
	<div class="row">
		<p class="section-label">Training log</p>

		<span class="muted small">
			{store.workouts.length}
			{store.workouts.length === 1 ? 'workout' : 'workouts'}
			logged
		</span>
	</div>

	<div class="chips" role="group" aria-label="Workout activity">
		{#each ACTIVITIES as a}
			<button
				class="chip"
				aria-pressed={workoutActivity === a.id}
				onclick={() => (workoutActivity = a.id)}
			>
				{a.label}
			</button>
		{/each}
	</div>

	{#if store.syncingWorkouts}

		<div class="empty-state">
			<span class="spinner" aria-hidden="true"></span>

			<p class="muted">Loading workouts...</p>
		</div>

	{:else if workoutPoints.length}

		<Chart
			points={workoutPoints}
			goal={workoutGoal}
			better={workoutActivity === 'run' ? 'lower' : 'higher'}
			format={workoutFormat}
			label={`${activityById(workoutActivity).label} workouts over time`}
		/>

		<p class="muted small">
			{#if workoutActivity === 'run'}
				Run values are pace per mile, calculated from the
				distance and time you log.
			{:else if workoutActivity === 'plank'}
				Plank is a training activity, not a scored PFA event.
			{:else}
				Workouts logged on the Log tab appear here automatically.
			{/if}
		</p>

		{#if store.workoutError}
			<p class="error" role="alert">{store.workoutError}</p>
		{/if}

	{:else}

		<div class="empty-state">
			<h3>
				No {activityById(
					workoutActivity
				).label.toLowerCase()} workouts yet
			</h3>

			<p class="muted">
				Log a workout to see it appear on this chart.
			</p>

			<a class="btn ghost" href="/log">Log a workout</a>
		</div>

	{/if}
</section>

<!-- Latest event standings -->
<section class="card stack">
	<p class="section-label">Standings</p>

	{#if !accountReady || store.syncing}

		<p class="muted">
			Loading standings...
		</p>

	{:else}

		{#each standings as s (s.event.id)}
			<div
				class="standing"
				class:weakest={s.event.id === weakestId}
			>
				<div class="row standing-heading">
					<span>{s.event.label}</span>

					<span class="value">
						{formatValue(s.event, s.value)}
					</span>
				</div>

				<div
					class="bar"
					role="progressbar"
					aria-label={`${s.event.label} score`}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.max(
						0,
						Math.min(100, s.score)
					)}
				>
					<span
						style:width={`${Math.max(
							0,
							Math.min(100, s.score)
						)}%`}
					></span>
				</div>

				<p class="muted small">
					{s.score.toFixed(0)} pts —
					Best {formatValue(s.event, s.best)}
				</p>

				{#if s.event.id === weakestId}
					<p class="focus">
						<strong>Weakest.</strong>
						{s.event.focus}
					</p>
				{/if}
			</div>

		{:else}

			<p class="muted">
				{store.syncError
					? 'Unable to retrieve assessment standings.'
					: 'No assessment attempts yet.'}
			</p>

		{/each}

	{/if}
</section>

<!-- Assessment history -->
<section class="card stack">
	<p class="section-label">Assessment history</p>

	{#if !accountReady}

		<p class="muted">Loading assessment history...</p>

	{:else if store.attempts.length === 0}

		<p class="muted">No assessments recorded yet.</p>

	{:else}

		<ul class="history">
			{#each [...store.attempts].reverse() as a (a.id)}
				<li>
					<div class="row">
						<span class="muted date">
							{formatDate(a.date)}, {a.date.slice(0, 4)}

							{#if a.updatedAt}
								<span> · edited</span>
							{/if}
						</span>

						<span class="grow"></span>

						<span class="history-score">
							{compositeScore(a.results).toFixed(1)}
						</span>

						<button
							class="btn ghost small-btn"
							type="button"
							onclick={() => startEdit(a)}
							disabled={submitting ||
								store.savingAttempt ||
								store.syncing}
						>
							Edit
						</button>

						<button
							class="del"
							type="button"
							aria-label={`Delete assessment from ${formatDate(
								a.date
							)}`}
							onclick={() => removeAttempt(a)}
							disabled={submitting ||
								store.savingAttempt ||
								store.syncing}
						>
							&times;
						</button>
					</div>

					<p class="muted small">
						{EVENTS.map(
							(e) =>
								`${e.label}: ${formatValue(
									e,
									a.results[e.id]
								)}`
						).join(' · ')}
					</p>
				</li>
			{/each}
		</ul>

	{/if}
</section>

<!-- Record a new assessment -->
{#if isAdmin}

	<section class="card stack">
		<h2>Cadet assessments</h2>

		<p class="muted">
			Administrator accounts cannot submit personal
			cadet assessments. Visit the Admin page to
			review registered cadet scores and history.
		</p>

		<a href="/admin" class="btn ghost">
			View cadet PFA records
		</a>
	</section>

{:else}

	<form
		class="card stack"
		onsubmit={recordAttempt}
	>
		<h2>{editingId ? 'Edit assessment' : 'Record an assessment'}</h2>

		{#if isCadet}

			<p class="muted small">
				Your assessments are saved to your account
				and synchronized with the server.
			</p>

		{:else}

			<p class="muted small">
				You are using FormUp as a guest.
				Assessments are saved on this device only.
			</p>

		{/if}

		<div class="field">
			<label for="attempt-date">Date</label>

			<input
				id="attempt-date"
				type="date"
				bind:value={attemptDate}
				max={todayISO()}
				disabled={submitting}
				required
			/>
		</div>

		{#each EVENTS as e}
			<div class="field">
				<label for="in-{e.id}">
					{e.label}
					{e.kind === 'time'
						? '(m:ss)'
						: '(reps)'}
				</label>

				<input
					id="in-{e.id}"
					type={e.kind === 'time'
						? 'text'
						: 'number'}
					inputmode={e.kind === 'time'
						? 'text'
						: 'numeric'}
					placeholder={e.kind === 'time'
						? e.id === 'run'
							? '12:10'
							: '1:05'
						: '39'}
					min={e.kind !== 'time'
						? 1
						: undefined}
					step={e.kind !== 'time'
						? 1
						: undefined}
					bind:value={inputs[e.id]}
					disabled={submitting}
					required
				/>
			</div>
		{/each}

		{#if error}
			<div class="feedback error-feedback" role="alert">
				{error}
			</div>
		{/if}

		{#if success}
			<div class="feedback success-feedback" role="status">
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
					<circle cx="12" cy="12" r="10" />
					<path d="m8 12 3 3 5-6" />
				</svg>

				<span>{success}</span>
			</div>
		{/if}

		<button
			class="btn save-button"
			type="submit"
			disabled={
				!accountReady ||
				submitting ||
				store.savingAttempt ||
				store.syncing
			}
		>
			{#if submitting || store.savingAttempt}

				<span
					class="spinner button-spinner"
					aria-hidden="true"
				></span>

				Saving assessment...

			{:else if !accountReady || store.syncing}

				Loading assessments...

			{:else}

				{editingId ? 'Save changes' : 'Save attempt'}

			{/if}
		</button>

		{#if editingId}
			<button
				class="btn ghost"
				type="button"
				onclick={cancelEdit}
				disabled={submitting || store.savingAttempt}
			>
				Cancel edit
			</button>
		{/if}
	</form>

	<!-- Personal fitness target -->
	<section class="card stack">
		<h2>Fitness target</h2>

		<div class="field">
			<label for="target">
				Target composite score (1 to 100)
			</label>

			<input
				id="target"
				type="number"
				min="1"
				max="100"
				step="1"
				value={store.target}
				onchange={onTarget}
				disabled={!accountReady}
			/>
		</div>

		<p class="muted small">
			Your personal target is saved separately
			from other accounts on this device.
		</p>
	</section>

{/if}

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

	/* Synchronization status */

	.sync-panel {
		padding: var(--space-4);
	}

	.sync-status {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.sync-status svg {
		flex-shrink: 0;
	}

	.sync-status > div {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.sync-error {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	/* Assessment standings */

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

	.standing-heading {
		gap: var(--space-3);
	}

	.value {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.small {
		font-size: 0.875rem;
	}

	.focus {
		color: var(--color-accent);
		font-size: 0.9rem;
	}

	/* Empty assessment state */

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-6) var(--space-3);
	}

	.empty-state svg {
		color: var(--color-text-muted);
	}

	.empty-state p {
		max-width: 360px;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	/* Form feedback */

	.feedback {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}

	.feedback svg {
		flex-shrink: 0;
	}

	.success-feedback {
		color: var(--color-positive);
		border-color: var(--color-positive);
	}

	.error-feedback {
		color: var(--color-error, #ff8a8a);
		border-color: var(--color-error, #ff8a8a);
	}

	:global([data-theme='light']) .error-feedback {
		color: var(--color-error, #b42318);
		border-color: var(--color-error, #b42318);
	}

	/* Assessment history */

	.history {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.history li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.history li:last-child {
		border-bottom: 0;
	}

	.history-score {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 700;
	}

	.small-btn {
		min-height: var(--touch-target);
		padding: 0 var(--space-3);
		font-size: 0.8rem;
	}

	.history .del {
		min-width: var(--touch-target);
		min-height: var(--touch-target);
		border: 0;
		background: none;
		color: var(--color-text-muted);
		font-size: 1.5rem;
		cursor: pointer;
	}

	.history .del:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	/* Save button */

	.save-button {
		gap: var(--space-2);
	}

	button:disabled,
	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Loading indicator */

	.spinner {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		flex-shrink: 0;
		animation: spin 0.8s linear infinite;
	}

	.button-spinner {
		border-color: currentColor;
		border-right-color: transparent;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}

	@media (max-width: 380px) {
		.standing {
			padding: var(--space-2);
		}
	}
</style>
