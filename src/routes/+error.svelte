<script>
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>FormUp — {page.status}</title>
</svelte:head>

<section class="card stack error-card">
	<p class="section-label">{page.status}</p>

	<h1>
		{page.status === 404
			? 'Page not found'
			: page.status === 403
				? 'Access denied'
				: page.status === 401
					? 'Log in required'
					: 'Something went wrong'}
	</h1>

	<p class="muted">
		{page.error?.message ||
			'This page could not be loaded.'}
	</p>

	<div class="actions">
		<a class="btn" href="/">Back to home</a>

		<button
			class="btn ghost"
			type="button"
			onclick={() => window.location.reload()}
		>
			Try again
		</button>
	</div>
</section>

<style>
	.error-card {
		align-items: flex-start;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
