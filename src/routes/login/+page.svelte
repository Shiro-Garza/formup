<script>
	import { goto } from '$app/navigation';
	import { logIn, signUp } from '#lib/auth.svelte.js';

	let mode = $state('login');
	let role = $state('cadet');
	let error = $state('');
	let busy = $state(false);

	async function handleSubmit(event) {
		event.preventDefault();
		error = '';
		busy = true;

		// Read straight from the form so browser autofill is always picked up.
		const form = new FormData(event.currentTarget);
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');

		const result =
			mode === 'login'
				? await logIn({ email, password })
				: await signUp({ name: String(form.get('name') ?? ''), email, password, role });

		busy = false;
		if (result.ok) goto('/');
		else error = result.error;
	}

	function switchMode() {
		mode = mode === 'login' ? 'signup' : 'login';
		error = '';
	}
</script>

<h1>{mode === 'login' ? 'Log in' : 'Create account'}</h1>

<form class="card form" onsubmit={handleSubmit} novalidate>
	{#if mode === 'signup'}
		<label class="field">
			<span>Name</span>
			<input name="name" type="text" autocomplete="name" required />
		</label>

		<fieldset class="field roles">
			<legend>Role</legend>
			<label class="chip" class:selected={role === 'cadet'}>
				<input type="radio" name="role" value="cadet" bind:group={role} />
				Cadet
			</label>
			<label class="chip" class:selected={role === 'leader'}>
				<input type="radio" name="role" value="leader" bind:group={role} />
				Leader
			</label>
		</fieldset>
	{/if}

	<label class="field">
		<span>Email</span>
		<input name="email" type="email" inputmode="email" autocomplete="email" required />
	</label>

	<label class="field">
		<span>Password</span>
		<input
			name="password"
			type="password"
			autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
			required
		/>
	</label>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<button class="btn" type="submit" disabled={busy}>
		{mode === 'login' ? 'Log in' : 'Sign up'}
	</button>
</form>

<button class="link" type="button" onclick={switchMode}>
	{mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in'}
</button>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border: 0;
		padding: 0;
		margin: 0;
	}

	.field span,
	.field legend {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		padding: 0;
	}

	input[type='text'],
	input[type='email'],
	input[type='password'] {
		min-height: var(--touch-target);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		background: var(--color-bg);
		color: var(--color-text);
		font: inherit;
	}

	input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.roles {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.roles legend {
		width: 100%;
		margin-bottom: var(--space-2);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: var(--touch-target);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.chip input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.chip.selected {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.error {
		color: var(--color-accent);
		font-size: 0.9rem;
	}

	.link {
		align-self: center;
		min-height: var(--touch-target);
		background: none;
		border: 0;
		color: var(--color-text-muted);
		text-decoration: underline;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
