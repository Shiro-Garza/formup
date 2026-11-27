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
	const upcoming = $derived(
		data.sessions.filter((s) => s.date >= today)
	);

	let editingId = $state(null);
	let editTitle = $state('');
	let editDate = $state('');
	let editTime = $state('');
	let editLocation = $state('');
	let editDetail = $state('');
	let saving = $state(false);

	const rows = $derived(
		data.roster.map((r) => {
			const latest = r.attempts.at(-1) ?? null;

			return {
				...r,
				latest,
				composite: latest
					? compositeScore(latest.results)
					: null
			};
		})
	);

	// Open the editing form with existing session information.
	function startEdit(session) {
		editingId = session.id;
		editTitle = session.title;
		editDate = session.date;
		editTime = session.time;
		editLocation = session.location ?? '';
		editDetail = session.detail ?? '';
	}

	// Close the editing form without saving.
	function cancelEdit() {
		editingId = null;
		editTitle = '';
		editDate = '';
		editTime = '';
		editLocation = '';
		editDetail = '';
	}

	// Submit changes and close the form only after success.
	function handleEdit() {
		saving = true;

		return async ({ result, update }) => {
			try {
				await update({ reset: false });

				if (result.type === 'success') {
					cancelEdit();
				}
			} finally {
				saving = false;
			}
		};
	}

	// Prevent accidental session deletion.
	function confirmDelete({ cancel }) {
		if (!window.confirm('Are you sure you want to delete this PT session?')) {
			cancel();
		}
	}
</script>

<h1>Admin</h1>

{#if form?.success}
	<p class="feedback success-message" role="status">
		{form.success}
	</p>
{/if}

{#if form?.message}
	<p class="feedback error" role="alert">
		{form.message}
	</p>
{/if}

<!-- Create PT session -->
<form class="card stack" method="POST" action="?/addSession" use:enhance>
	<p class="section-label">Schedule a PT session</p>

	<div class="field">
		<label for="s-title">Title</label>
		<input
			id="s-title"
			name="title"
			placeholder="Run Day"
			maxlength="80"
			required
		/>
	</div>

	<div class="two">
		<div class="field">
			<label for="s-date">Date</label>
			<input
				id="s-date"
				name="date"
				type="date"
				min={today}
				required
			/>
		</div>

		<div class="field">
			<label for="s-time">Start time</label>
			<input
				id="s-time"
				name="time"
				type="time"
				value="06:00"
				required
			/>
		</div>
	</div>

	<div class="field">
		<label for="s-location">Location</label>
		<input
			id="s-location"
			name="location"
			placeholder="UTSA Rec Field"
			maxlength="120"
		/>
	</div>

	<div class="field">
		<label for="s-detail">Details</label>
		<input
			id="s-detail"
			name="detail"
			placeholder="1 minute sprints, 1:30 walk"
			maxlength="200"
		/>
	</div>

	<button class="btn" type="submit">
		Add session
	</button>
</form>

<!-- Upcoming PT sessions -->
<section class="card stack">
	<div class="row">
		<p class="section-label">Upcoming sessions</p>
		<span class="muted">{upcoming.length} scheduled</span>
	</div>

	{#each upcoming as s (s.id)}
		<div class="session">

			{#if editingId === s.id}
				<!-- Edit session form -->
				<form
					class="edit-form stack"
					method="POST"
					action="?/editSession"
					use:enhance={handleEdit}
				>
					<h2 class="edit-heading">Edit PT session</h2>

					<input type="hidden" name="id" value={s.id} />

					<div class="field">
						<label for="edit-title">Title</label>
						<input
							id="edit-title"
							name="title"
							bind:value={editTitle}
							maxlength="80"
							required
						/>
					</div>

					<div class="two">
						<div class="field">
							<label for="edit-date">Date</label>
							<input
								id="edit-date"
								name="date"
								type="date"
								min={today}
								bind:value={editDate}
								required
							/>
						</div>

						<div class="field">
							<label for="edit-time">Start time</label>
							<input
								id="edit-time"
								name="time"
								type="time"
								bind:value={editTime}
								required
							/>
						</div>
					</div>

					<div class="field">
						<label for="edit-location">Location</label>
						<input
							id="edit-location"
							name="location"
							bind:value={editLocation}
							placeholder="UTSA Rec Field"
							maxlength="120"
						/>
					</div>

					<div class="field">
						<label for="edit-detail">Details</label>
						<textarea
							id="edit-detail"
							name="detail"
							bind:value={editDetail}
							rows="3"
							maxlength="200"
						></textarea>
					</div>

					{#if form?.message}
						<p class="error" role="alert">{form.message}</p>
					{/if}

					<div class="two">
						<button
							class="btn"
							type="submit"
							disabled={saving}
						>
							{saving ? 'Saving...' : 'Save changes'}
						</button>

						<button
							class="btn ghost"
							type="button"
							onclick={cancelEdit}
							disabled={saving}
						>
							Cancel
						</button>
					</div>
				</form>

			{:else}
				<!-- Normal session display -->
				<div class="session-info">
					<strong>
						{formatDate(s.date)} · {s.time.replace(':', '')}
					</strong>

					<p class="muted">
						{s.title}{s.detail ? `: ${s.detail}` : ''}
					</p>

					<p class="location">
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
							{s.location || 'Location to be announced'}
						</span>
					</p>
				</div>

				<div class="session-actions">
					<button
						class="btn edit-button"
						type="button"
						onclick={() => startEdit(s)}
						disabled={saving}
						aria-label="Edit {s.title} on {formatDate(s.date)}"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m16 3 5 5-12 12-6 1 1-6Z" />
							<path d="m14 5 5 5" />
						</svg>
						Edit
					</button>

					<form
						method="POST"
						action="?/deleteSession"
						use:enhance={confirmDelete}
					>
						<input type="hidden" name="id" value={s.id} />

						<button
							class="btn ghost delete-button"
							type="submit"
							disabled={saving}
							aria-label="Delete {s.title} on {formatDate(s.date)}"
						>
							Delete
						</button>
					</form>
				</div>
			{/if}
		</div>

	{:else}
		<p class="muted">No upcoming sessions.</p>
	{/each}
</section>

<!-- Cadet PFA scores -->
<section class="card stack">
	<p class="section-label">PFA scores by cadet</p>

	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th>Cadet</th>

					{#each EVENTS as e}
						<th>{e.label}</th>
					{/each}

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
								<td>
									{formatValue(e, r.latest.results[e.id])}
								</td>
							{/each}

							<td class="stat-cell">
								{r.composite.toFixed(1)}
							</td>
						{:else}
							<td class="muted" colspan={EVENTS.length + 1}>
								No attempts yet
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#each rows.filter((r) => r.attempts.length > 1) as r (r.email)}
		<details>
			<summary>
				{r.name}: all {r.attempts.length} attempts
			</summary>

			<ul>
				{#each [...r.attempts].reverse() as a (a.id)}
					<li class="row">
						<span class="muted">
							{formatDate(a.date)}
						</span>

						<span>
							{EVENTS.map((e) =>
								formatValue(e, a.results[e.id])
							).join(' · ')}
						</span>

						<span class="stat-cell">
							{compositeScore(a.results).toFixed(1)}
						</span>
					</li>
				{/each}
			</ul>
		</details>
	{/each}
</section>

<style>
	.two {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-3);
	}

	.session {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.session:last-child {
		border-bottom: 0;
	}

	.session-info {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.location {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-text);
		font-size: 0.875rem;
		margin-top: var(--space-2);
	}

	.location svg {
		color: var(--color-accent);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.location span {
		min-width: 0;
	}

	.session-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.edit-button {
		gap: var(--space-2);
	}

	.edit-form {
		width: 100%;
		padding: var(--space-4);
		background: var(--color-bg);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-card);
	}

	.edit-heading {
		color: var(--color-accent);
	}

	.feedback {
		padding: var(--space-3);
		background: var(--color-card);
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
	}

	.success-message {
		color: var(--color-positive);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	@media (max-width: 600px) {
		.session {
			flex-direction: column;
		}

		.session-info {
			width: 100%;
		}

		.session-actions {
			width: 100%;
		}

		.session-actions > * {
			flex: 1;
		}

		.session-actions form button {
			width: 100%;
		}
	}

	@media (max-width: 380px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
