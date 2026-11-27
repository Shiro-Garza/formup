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

	let { data } = $props();

	// Chart event selection.
	let selected = $state('run');

	const ev = $derived(eventById(selected));

	const points = $derived(
		store.attempts.map((a) => ({
			label: formatDate(a.date),
			value: a.results[selected]
		}))
	);

	// Calculate standings from the latest assessment.
	const standings = $derived(
		store.latest
			? EVENTS.map((e) => {
				const values = store.attempts.map(
					(a) => a.results[e.id]
				);

				const best =
					e.better === 'lower'
						? Math.min(...values)
						: Math.max(...values);

				return {
					event: e,
					value: store.latest.results[e.id],
					score: eventScore(
						e,
						store.latest.results[e.id]
					),
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

	let inputs = $state({
		run: '',
		pushups: '',
		plank: ''
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

		attemptDate = todayISO();

		inputs = {
			run: '',
			pushups: '',
			plank: ''
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

		submitting = true;

		try {
			// Use the centralized submission function.
			// Cadet assessments are saved on the server.
			// Guest assessments remain local.
			const saved = await store.submitAttempt({
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
				plank: ''
			};

			success = isCadet
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

<h1>Progress</h1>

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
		<h2>Record an assessment</h2>

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

				Save attempt

			{/if}
		</button>
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
