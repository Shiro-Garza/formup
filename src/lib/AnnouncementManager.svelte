
<script>
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '#lib/events.js';

	let { announcements = [] } = $props();

	// Publish form state.
	let title = $state('');
	let message = $state('');
	let priority = $state('normal');

	// Edit form state.
	let editingId = $state(null);
	let editTitle = $state('');
	let editMessage = $state('');
	let editPriority = $state('normal');

	// Submission state.
	let busy = $state(false);
	let feedback = $state(null);

	const published = $derived(
		[...announcements].sort((a, b) =>
			b.createdAt.localeCompare(a.createdAt)
		)
	);

	function resetForm() {
		title = '';
		message = '';
		priority = 'normal';
	}

	function startEdit(announcement) {
		editingId = announcement.id;
		editTitle = announcement.title;
		editMessage = announcement.message;
		editPriority = announcement.priority ?? 'normal';
		feedback = null;
	}

	function cancelEdit() {
		editingId = null;
		editTitle = '';
		editMessage = '';
		editPriority = 'normal';
		feedback = null;
	}

	function handleAnnouncement({ cancel, action }) {
		if (busy) {
			cancel();
			return;
		}

		const isDelete =
			action.searchParams.has('/deleteAnnouncement');

		const isEdit =
			action.searchParams.has('/editAnnouncement');

		const isAdd =
			action.searchParams.has('/addAnnouncement');

		if (
			isDelete &&
			!window.confirm(
				'Are you sure you want to delete this announcement?'
			)
		) {
			cancel();
			return;
		}

		busy = true;
		feedback = null;

		return async ({ result }) => {
			try {
				if (result.type === 'success') {
					await invalidateAll();

					if (isAdd) {
						resetForm();
					}

					if (isEdit || isDelete) {
						cancelEdit();
					}

					feedback = {
						success: true,
						message:
							result.data?.success ??
							'Announcement updated successfully.'
					};
				} else if (result.type === 'failure') {
					feedback = {
						success: false,
						message:
							result.data?.message ??
							'Unable to update announcement.'
					};
				} else {
					await applyAction(result);
				}
			} catch (err) {
				feedback = {
					success: false,
					message:
						'Unable to refresh announcements. Please refresh the page.'
				};
			} finally {
				busy = false;
			}
		};
	}
</script>

<section
	class="card stack"
	aria-labelledby="announcement-heading"
>
	<h2 id="announcement-heading">
		Announcement Management
	</h2>

	<p class="muted">
		Publish updates, reminders, and important
		information for cadets.
	</p>

	{#if feedback}
		{#if feedback.success}
			<p class="announcement-feedback positive" role="status">
				{feedback.message}
			</p>
		{:else}
			<p class="announcement-feedback error" role="alert">
				{feedback.message}
			</p>
		{/if}
	{/if}

	<!-- Publish announcement -->
	<form
		class="stack"
		method="POST"
		action="?/addAnnouncement"
		use:enhance={handleAnnouncement}
	>
		<div class="field">
			<div class="row">
				<label for="announcement-title">
					Title
				</label>

				<span class="muted counter">
					{title.length}/80
				</span>
			</div>

			<input
				id="announcement-title"
				name="title"
				placeholder="PT Uniform Reminder"
				bind:value={title}
				maxlength="80"
				disabled={busy}
				required
			/>
		</div>

		<div class="field">
			<div class="row">
				<label for="announcement-message">
					Message
				</label>

				<span class="muted counter">
					{message.length}/1000
				</span>
			</div>

			<textarea
				id="announcement-message"
				name="message"
				placeholder="Enter your announcement..."
				bind:value={message}
				maxlength="1000"
				rows="4"
				disabled={busy}
				required
			></textarea>
		</div>

		<!-- Priority selection -->
		<fieldset class="priority-field">
			<legend>Priority</legend>

			<input
				type="hidden"
				name="priority"
				value={priority}
			/>

			<div class="two">
				<button
					class="btn"
					class:ghost={priority !== 'normal'}
					type="button"
					aria-pressed={priority === 'normal'}
					onclick={() => (priority = 'normal')}
					disabled={busy}
				>
					Normal
				</button>

				<button
					class="btn"
					class:ghost={priority !== 'important'}
					type="button"
					aria-pressed={priority === 'important'}
					onclick={() => (priority = 'important')}
					disabled={busy}
				>
					Important
				</button>
			</div>
		</fieldset>

		<p class="muted small">
			Important announcements will be
			highlighted on the Home dashboard.
		</p>

		<button
			class="btn"
			type="submit"
			disabled={
				busy ||
				!title.trim() ||
				!message.trim()
			}
		>
			{busy
				? 'Please wait...'
				: 'Publish announcement'}
		</button>
	</form>

	<!-- Published announcements -->
	<div class="published-heading row">
		<h3>Published announcements</h3>

		<span class="muted">
			{published.length} published
		</span>
	</div>

	{#each published as a (a.id)}
		<div
			class="announcement-item"
			class:important={a.priority === 'important'}
		>
			{#if editingId === a.id}
				<!-- Edit announcement -->
				<form
					class="stack"
					method="POST"
					action="?/editAnnouncement"
					use:enhance={handleAnnouncement}
				>
					<h3 class="edit-heading">
						Edit announcement
					</h3>

					<input
						type="hidden"
						name="id"
						value={a.id}
					/>

					<div class="field">
						<div class="row">
							<label for="edit-announcement-title">
								Title
							</label>

							<span class="muted counter">
								{editTitle.length}/80
							</span>
						</div>

						<input
							id="edit-announcement-title"
							name="title"
							bind:value={editTitle}
							maxlength="80"
							disabled={busy}
							required
						/>
					</div>

					<div class="field">
						<div class="row">
							<label for="edit-announcement-message">
								Message
							</label>

							<span class="muted counter">
								{editMessage.length}/1000
							</span>
						</div>

						<textarea
							id="edit-announcement-message"
							name="message"
							bind:value={editMessage}
							maxlength="1000"
							rows="4"
							disabled={busy}
							required
						></textarea>
					</div>

					<fieldset class="priority-field">
						<legend>Priority</legend>

						<input
							type="hidden"
							name="priority"
							value={editPriority}
						/>

						<div class="two">
							<button
								class="btn"
								class:ghost={editPriority !== 'normal'}
								type="button"
								aria-pressed={editPriority === 'normal'}
								onclick={() => (editPriority = 'normal')}
								disabled={busy}
							>
								Normal
							</button>

							<button
								class="btn"
								class:ghost={editPriority !== 'important'}
								type="button"
								aria-pressed={editPriority === 'important'}
								onclick={() => (editPriority = 'important')}
								disabled={busy}
							>
								Important
							</button>
						</div>
					</fieldset>

					<div class="two">
						<button
							class="btn"
							type="submit"
							disabled={
								busy ||
								!editTitle.trim() ||
								!editMessage.trim()
							}
						>
							{busy
								? 'Saving...'
								: 'Save changes'}
						</button>

						<button
							class="btn ghost"
							type="button"
							onclick={cancelEdit}
							disabled={busy}
						>
							Cancel
						</button>
					</div>
				</form>

			{:else}
				<!-- Published announcement -->
				<div class="announcement-meta">
					<span class="muted small">
						{formatDate(a.date)}, {a.date.slice(0, 4)}
						{a.updatedAt ? ' — Edited' : ''}
					</span>

					{#if a.priority === 'important'}
						<span class="priority-important">
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
								<circle cx="12" cy="12" r="10" />
								<path d="M12 8v4M12 16h.01" />
							</svg>

							Important
						</span>
					{:else}
						<span class="muted small">
							Normal
						</span>
					{/if}
				</div>

				<h3 class="announcement-title">
					{a.title}
				</h3>

				<p class="announcement-message">
					{a.message}
				</p>

				<div class="announcement-actions">
					<button
						class="btn edit-button"
						type="button"
						onclick={() => startEdit(a)}
						disabled={busy}
						aria-label={`Edit ${a.title}`}
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
						action="?/deleteAnnouncement"
						use:enhance={handleAnnouncement}
					>
						<input
							type="hidden"
							name="id"
							value={a.id}
						/>

						<button
							class="btn ghost"
							type="submit"
							disabled={busy}
							aria-label={`Delete ${a.title}`}
						>
							Delete
						</button>
					</form>
				</div>
			{/if}
		</div>

	{:else}
		<p class="muted">
			No announcements have been published yet.
		</p>
	{/each}
</section>

<style>
	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}

	.counter {
		font-size: 0.75rem;
	}

	.small {
		font-size: 0.8rem;
	}

	textarea {
		width: 100%;
		min-height: 110px;
		resize: vertical;
	}

	.priority-field {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.priority-field legend {
		margin-bottom: var(--space-2);
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.announcement-feedback {
		padding: var(--space-3);
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
	}

	.published-heading {
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.announcement-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.announcement-item.important {
		border-color: var(--color-accent);
	}

	.announcement-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.priority-important {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-accent);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.announcement-title {
		color: var(--color-text);
	}

	.announcement-message {
		white-space: pre-wrap;
		color: var(--color-text-muted);
		overflow-wrap: anywhere;
		line-height: 1.5;
	}

	.announcement-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.announcement-actions form button {
		width: 100%;
	}

	.edit-button {
		gap: var(--space-2);
	}

	.edit-heading {
		color: var(--color-accent);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 380px) {
		.announcement-item {
			padding: var(--space-3);
		}
	}
</style>
