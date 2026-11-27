<script>
	import { onMount } from 'svelte';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
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
		if (!window.confirm(
			'Delete this PT session and all associated attendance records?'
		)) {
			cancel();
		}
	}

	// Attendance dashboard.
	let attendanceSessionId = $state('');
	let attendanceBusy = $state(false);
	let attendanceFeedback = $state(null);
	let now = $state(Date.now());

	onMount(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => clearInterval(timer);
	});

	function sessionStart(s) {
		return new Date(
			`${s.date}T${s.time}:00`
		).getTime();
	}

	const attendanceSessions = $derived(
		[...data.sessions].sort((a, b) =>
			`${b.date} ${b.time}`.localeCompare(
				`${a.date} ${a.time}`
			)
		)
	);

	const selectedSession = $derived(
		attendanceSessions.find(
			(s) => s.id === attendanceSessionId
		) ??
		attendanceSessions.find(
			(s) => sessionStart(s) - 15 * 60000 <= now
		) ??
		attendanceSessions.at(-1) ??
		null
	);

	const attendancePhase = $derived.by(() => {
		if (!selectedSession) return 'none';

		const start = sessionStart(selectedSession);

		if (!Number.isFinite(start)) return 'invalid';

		if (now < start - 15 * 60000) {
			return 'upcoming';
		}

		if (now > start + 120 * 60000) {
			return 'closed';
		}

		return 'open';
	});

	const attendanceRows = $derived(
		(data.attendanceRoster ?? []).map((cadet) => ({
			...cadet,
			record: (data.attendance ?? []).find(
				(a) =>
					a.sessionId === selectedSession?.id &&
					a.email.toLowerCase() === cadet.email.toLowerCase()
			)
		}))
	);

	const presentCount = $derived(
		attendanceRows.filter((r) => r.record).length
	);

	const notPresentCount = $derived(
		attendanceRows.length - presentCount
	);

	const attendanceRate = $derived(
		attendanceRows.length
			? Math.round(
				100 * presentCount / attendanceRows.length
			)
			: 0
	);

	const canMarkPresent = $derived(
		attendancePhase === 'open' ||
		attendancePhase === 'closed'
	);

	function attendanceTime(value) {
		const date = new Date(value);

		return Number.isFinite(date.getTime())
			? date.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			})
			: 'Time unavailable';
	}

	// Handle attendance separately from scheduling feedback.
	function handleAttendance({ cancel, formData, action }) {
		if (attendanceBusy) {
			cancel();
			return;
		}

		if (
			action.searchParams.has('/removeAttendance') &&
			!window.confirm(
				'Remove this cadet’s attendance record?'
			)
		) {
			cancel();
			return;
		}

		const sessionId = String(
			formData.get('sessionId') ?? ''
		);

		attendanceSessionId = sessionId;
		attendanceFeedback = null;
		attendanceBusy = true;

		return async ({ result }) => {
			try {
				if (result.type === 'success') {
					await invalidateAll();

					attendanceFeedback = {
						sessionId,
						success: true,
						message:
							result.data?.success ??
							'Attendance updated successfully.'
					};

				} else if (result.type === 'failure') {
					attendanceFeedback = {
						sessionId,
						success: false,
						message:
							result.data?.message ??
							'Unable to update attendance.'
					};

				} else {
					await applyAction(result);
				}

			} catch (err) {
				attendanceFeedback = {
					sessionId,
					success: false,
					message: 'Unable to refresh attendance. Please refresh the page.'
				};

			} finally {
				attendanceBusy = false;
			}
		};
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
<form
	class="card stack"
	method="POST"
	action="?/addSession"
	use:enhance
>
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

		<span class="muted">
			{upcoming.length} scheduled
		</span>
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
					<h2 class="edit-heading">
						Edit PT session
					</h2>

					<input
						type="hidden"
						name="id"
						value={s.id}
					/>

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
							<label for="edit-time">
								Start time
							</label>

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
						<label for="edit-location">
							Location
						</label>

						<input
							id="edit-location"
							name="location"
							bind:value={editLocation}
							placeholder="UTSA Rec Field"
							maxlength="120"
						/>
					</div>

					<div class="field">
						<label for="edit-detail">
							Details
						</label>

						<textarea
							id="edit-detail"
							name="detail"
							bind:value={editDetail}
							rows="3"
							maxlength="200"
						></textarea>
					</div>

					{#if form?.message}
						<p class="error" role="alert">
							{form.message}
						</p>
					{/if}

					<div class="two">
						<button
							class="btn"
							type="submit"
							disabled={saving}
						>
							{saving
								? 'Saving...'
								: 'Save changes'}
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
						{formatDate(s.date)} ·
						{s.time.replace(':', '')}
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
						<input
							type="hidden"
							name="id"
							value={s.id}
						/>

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

<!-- PT Attendance Management -->
<section
	class="card stack"
	aria-labelledby="attendance-heading"
>
	<h2 id="attendance-heading">
		PT Attendance Management
	</h2>

	{#if selectedSession}
		<div class="field">
			<label for="attendance-session">
				Select PT session
			</label>

			<select
				id="attendance-session"
				value={selectedSession.id}
				onchange={(e) => {
					attendanceSessionId = e.currentTarget.value;
					attendanceFeedback = null;
				}}
				disabled={attendanceBusy}
			>
				{#each attendanceSessions as s (s.id)}
					<option value={s.id}>
						{formatDate(s.date)},
						{s.date.slice(0, 4)} ·
						{s.time.replace(':', '')} —
						{s.title}
					</option>
				{/each}
			</select>
		</div>

		<p class="muted">
			{selectedSession.location || 'Location to be announced'}
		</p>

		<p
			class="attendance-phase"
			class:positive={attendancePhase === 'open'}
		>
			{attendancePhase === 'open'
				? 'Check-in open'
				: attendancePhase === 'closed'
					? 'Check-in closed — admin corrections available'
					: attendancePhase === 'upcoming'
						? 'Upcoming — check-in not open yet'
						: 'Invalid session time'}
		</p>

		<!-- Attendance statistics -->
		<div class="attendance-stats">
			<div>
				<strong>{attendanceRows.length}</strong>
				<span>Total cadets</span>
			</div>

			<div>
				<strong class="positive">
					{presentCount}
				</strong>
				<span>Present</span>
			</div>

			<div>
				<strong>{notPresentCount}</strong>

				<span>
					{attendancePhase === 'closed'
						? 'Absent'
						: attendancePhase === 'open'
							? 'Not checked in'
							: 'Pending'}
				</span>
			</div>
		</div>

		<!-- Attendance percentage -->
		<div class="row">
			<span class="muted">
				{attendancePhase === 'closed'
					? 'Attendance rate'
					: 'Check-in rate so far'}
			</span>

			<strong class="positive">
				{attendanceRows.length && canMarkPresent
					? `${attendanceRate}%`
					: '—'}
			</strong>
		</div>

		{#if attendanceRows.length && canMarkPresent}
			<div
				class="bar"
				role="progressbar"
				aria-label="Attendance rate"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={attendanceRate}
			>
				<span style:width={`${attendanceRate}%`}></span>
			</div>
		{/if}

		<p class="muted small">
			Based on currently registered cadets,
			not historical enrollment.
		</p>

		<!-- Cadet attendance roster -->
		<h3>Cadet attendance roster</h3>

		<!-- Session-specific attendance feedback -->
		{#if attendanceFeedback && attendanceFeedback.sessionId === selectedSession.id}
			{#if attendanceFeedback.success}
				<p class="positive" role="status">
					{attendanceFeedback.message}
				</p>
			{:else}
				<p class="error" role="alert">
					{attendanceFeedback.message}
				</p>
			{/if}
		{/if}

		{#each attendanceRows as r (r.email)}
			<div class="attendance-row">
				<div class="attendance-person">
					<strong>
						{r.name || r.email}
					</strong>

					<span class="muted small">
						{r.email}
					</span>

					{#if r.record}
						<p class="positive">
							Present ✓
						</p>

						<p class="muted small">
							{r.record.source === 'admin'
								? 'Recorded by admin'
								: 'Self check-in'}
							· {attendanceTime(r.record.checkedInAt)}
						</p>

					{:else if attendancePhase === 'closed'}
						<p class="error">
							Absent
						</p>

					{:else if attendancePhase === 'open'}
						<p class="attendance-pending">
							Not checked in
						</p>

					{:else}
						<p class="muted">
							{attendancePhase === 'upcoming'
								? 'Upcoming'
								: 'Unavailable'}
						</p>
					{/if}
				</div>

				<form
					method="POST"
					action={r.record
						? '?/removeAttendance'
						: '?/markPresent'}
					use:enhance={handleAttendance}
				>
					<input
						type="hidden"
						name="sessionId"
						value={selectedSession.id}
					/>

					<input
						type="hidden"
						name="email"
						value={r.email}
					/>

					<button
						class="btn"
						class:ghost={!!r.record}
						type="submit"
						disabled={
							attendanceBusy ||
							(!r.record && !canMarkPresent)
						}
						aria-label={`${r.record
							? 'Remove attendance for'
							: 'Mark present:'} ${r.name || r.email}`}
					>
						{r.record
							? 'Remove'
							: 'Mark present'}
					</button>
				</form>
			</div>

		{:else}
			<p class="muted">
				No cadets registered.
			</p>
		{/each}

	{:else}
		<p class="muted">
			Create a PT session to manage attendance.
		</p>
	{/if}
</section>

<!-- Cadet PFA scores -->
<section class="card stack">
	<p class="section-label">
		PFA scores by cadet
	</p>

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

							<span class="muted small">
								{r.email}
							</span>
						</td>

						{#if r.latest}
							{#each EVENTS as e}
								<td>
									{formatValue(
										e,
										r.latest.results[e.id]
									)}
								</td>
							{/each}

							<td class="stat-cell">
								{r.composite.toFixed(1)}
							</td>

						{:else}
							<td
								class="muted"
								colspan={EVENTS.length + 1}
							>
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

	/* Attendance statistics */
	.attendance-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.attendance-stats > div {
		background: var(--color-bg);
		padding: var(--space-3) var(--space-2);
		border-radius: var(--radius-control);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.attendance-stats strong {
		display: block;
		font-family: var(--font-display);
		font-size: 1.75rem;
	}

	.attendance-stats span {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.attendance-phase {
		font-size: 0.875rem;
	}

	.attendance-pending {
		color: var(--color-accent);
	}

	/* Attendance roster */
	.attendance-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.attendance-row:last-child {
		border-bottom: 0;
	}

	.attendance-person {
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}

	.attendance-row form {
		flex-shrink: 0;
	}

	#attendance-session {
		width: 100%;
		min-width: 0;
	}

	/* Mobile responsiveness */
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

		.attendance-row {
			flex-direction: column;
			align-items: stretch;
		}

		.attendance-row form button {
			width: 100%;
		}
	}

	@media (max-width: 380px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
