<script>
	import {
		EVENTS,
		compositeScore,
		formatValue,
		formatDate
	} from '#lib/events.js';

	let { roster = [] } = $props();

	const rows = $derived(
		roster.map((r) => {
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
</script>

<section class="card stack" aria-labelledby="pfa-heading">
	<div class="row pfa-heading">
		<h2 id="pfa-heading">PFA scores by cadet</h2>

		<span class="muted small">
			{rows.length} {rows.length === 1 ? 'cadet' : 'cadets'}
		</span>
	</div>

	<!-- Desktop table -->
	<div class="pfa-desktop stack">
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th scope="col">Cadet</th>

						{#each EVENTS as e}
							<th scope="col">{e.label}</th>
						{/each}

						<th scope="col">Composite</th>
					</tr>
				</thead>

				<tbody>
					{#each rows as r (r.email)}
						<tr>
							<td>
								<strong>{r.name || r.email}</strong>
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
					{:else}
						<tr>
							<td class="muted" colspan={EVENTS.length + 2}>
								No cadets registered.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Desktop assessment history -->
		{#each rows.filter((r) => r.attempts.length > 1) as r (r.email)}
			<details class="pfa-history">
				<summary>
					{r.name || r.email}: all {r.attempts.length} attempts
				</summary>

				{#each [...r.attempts].reverse() as a (a.id)}
					<div class="row history-row">
						<span class="muted">
							{formatDate(a.date)}, {a.date.slice(0, 4)}
						</span>

						<span>
							{EVENTS.map((e) =>
								formatValue(e, a.results[e.id])
							).join(' — ')}
						</span>

						<strong class="stat-cell">
							{compositeScore(a.results).toFixed(1)}
						</strong>
					</div>
				{/each}
			</details>
		{/each}
	</div>

	<!-- Mobile cadet cards -->
	<div class="pfa-mobile">
		{#each rows as r (r.email)}
			<article class="pfa-cadet-card">
				<div class="cadet-header">
					<h3>{r.name || r.email}</h3>
					<span class="muted small">{r.email}</span>
				</div>

				{#if r.latest}
					<div class="assessment-date">
						<span class="muted">Latest assessment</span>

						<strong>
							{formatDate(r.latest.date)},
							{r.latest.date.slice(0, 4)}
						</strong>
					</div>

					<dl class="pfa-events">
						{#each EVENTS as e}
							<div class="pfa-event">
								<dt>{e.label}</dt>

								<dd>
									{formatValue(e, r.latest.results[e.id])}
								</dd>
							</div>
						{/each}
					</dl>

					<div class="pfa-composite">
						<div>
							<p>Composite score</p>
							<span class="muted small">Latest assessment</span>
						</div>

						<strong class="pfa-score">
							{r.composite.toFixed(1)}
						</strong>
					</div>

					<div
						class="bar"
						role="progressbar"
						aria-label={`Composite score for ${r.name || r.email}`}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.max(0, Math.min(100, r.composite))}
					>
						<span
							style:width={`${Math.max(0, Math.min(100, r.composite))}%`}
						></span>
					</div>

					<!-- Mobile assessment history -->
					{#if r.attempts.length > 1}
						<details class="pfa-history">
							<summary>
								View assessment history ({r.attempts.length})
							</summary>

							<div class="history-list">
								{#each [...r.attempts].reverse() as a (a.id)}
									<div class="history-item">
										<div class="row">
											<strong>
												{formatDate(a.date)}, {a.date.slice(0, 4)}
											</strong>

											<span class="stat-cell">
												{compositeScore(a.results).toFixed(1)}
											</span>
										</div>

										<dl class="pfa-events">
											{#each EVENTS as e}
												<div class="pfa-event">
													<dt>{e.label}</dt>

													<dd>
														{formatValue(e, a.results[e.id])}
													</dd>
												</div>
											{/each}
										</dl>
									</div>
								{/each}
							</div>
						</details>
					{/if}

				{:else}
					<!-- Empty assessment state -->
					<div class="pfa-empty">
						<svg
							width="36"
							height="36"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<rect x="8" y="3" width="8" height="4" rx="1" />
							<path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
							<path d="M8 12h8M8 16h5" />
						</svg>

						<h3>No assessments yet</h3>

						<p class="muted">
							PFA results will appear here once this cadet
							records an assessment.
						</p>
					</div>
				{/if}
			</article>
		{:else}
			<p class="muted">No cadets registered.</p>
		{/each}
	</div>
</section>

<style>
	.pfa-heading {
		flex-wrap: wrap;
	}

	.small {
		display: block;
		font-size: 0.75rem;
	}

	/* Desktop layout */

	.pfa-desktop {
		display: flex;
		min-width: 0;
	}

	.pfa-mobile {
		display: none;
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
	}

	td:first-child {
		overflow-wrap: anywhere;
	}

	.stat-cell {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-accent);
	}

	/* Mobile cadet cards */

	.pfa-cadet-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.cadet-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-border);
	}

	.cadet-header h3 {
		font-size: 1.4rem;
		color: var(--color-text);
	}

	.assessment-date {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		font-size: 0.8rem;
	}

	/* Event scores */

	.pfa-events {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: 0;
	}

	.pfa-event {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.pfa-event dt {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		min-width: 0;
	}

	.pfa-event dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-text);
		flex-shrink: 0;
	}

	/* Composite score */

	.pfa-composite {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
	}

	.pfa-composite p {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.pfa-score {
		font-family: var(--font-display);
		font-size: 2.25rem;
		font-weight: 700;
		color: var(--color-accent);
		line-height: 1;
	}

	.pfa-cadet-card .bar {
		background: var(--color-card);
	}

	/* Assessment history */

	.pfa-history {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.pfa-history summary {
		min-height: var(--touch-target);
		padding: var(--space-3);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.pfa-history summary:hover {
		background: var(--color-hover);
	}

	.pfa-history summary:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: -3px;
	}

	.history-row {
		padding: var(--space-3);
		border-top: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
	}

	.history-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
	}

	.history-item > .row {
		flex-wrap: wrap;
	}

	/* Empty state */

	.pfa-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
		padding: var(--space-5) var(--space-2);
	}

	.pfa-empty svg {
		color: var(--color-text-muted);
		margin-bottom: var(--space-1);
	}

	.pfa-empty p {
		font-size: 0.875rem;
		line-height: 1.5;
	}

	/* Responsive layout */

	@media (max-width: 767px) {
		.pfa-desktop {
			display: none;
		}

		.pfa-mobile {
			display: flex;
			flex-direction: column;
			gap: var(--space-3);
		}
	}

	@media (max-width: 380px) {
		.pfa-cadet-card {
			padding: var(--space-3);
		}
	}
</style>
