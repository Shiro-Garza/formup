<script>
	import { auth, logOut } from '#lib/auth.svelte.js';
</script>

<h1>Hi, {auth.user?.name}</h1>

<section class="card">
	<p class="muted">Today's PT</p>
	<h2>No session scheduled</h2>
	<button class="btn">Mark attended</button>
</section>

<section class="card">
	<p class="muted">Progress toward target</p>
	<p class="stat">0%</p>
</section>

<button class="btn secondary" onclick={logOut}>Log out</button>

<style>
	.secondary {
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}
</style>
