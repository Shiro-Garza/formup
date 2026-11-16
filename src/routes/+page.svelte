<script>
	import { onMount } from 'svelte';
	import LoginModal from '#lib/LoginModal.svelte';

	//login script
	let { form } = $props();
  	let showLoginModal = $state(false);

	//time tracking algorithm 
  	let time = $state(new Date());

	const hours = $derived(String(time.getHours()).padStart(2, '0'));
	const minutes = $derived(String(time.getMinutes()).padStart(2, '0'));
	const seconds = $derived(String(time.getSeconds()).padStart(2, '0'));
	//if statement for moring afternoon evening on main page
	let greeting = parseInt(hours, 10) < 12 ? 'Morning' : parseInt(hours, 10) < 18 ? 'Afternoon' : 'Evening';

	onMount(() => {
		const interval = setInterval(() => {
		time = new Date();
	}, 1000);

    return () => clearInterval(interval);
  });
	
</script>

<header>
  <h1>My App</h1>
  <button class="btn" onclick={() => (showLoginModal = true)}>Log In</button>
</header>

<LoginModal bind:open={showLoginModal} {form} />

<section class="welcome-title">
	<h1>Good {greeting}</h1>
	<p>Current Time: {hours}:{minutes}:{seconds}</p>
</section>
<h1>Home</h1>

<section class="card">
	<p class="muted">Today's PT</p>
	<h2>No session scheduled</h2>
	<button class="btn">Mark attended</button>
</section>

<section class="card">
	<p class="muted">Progress toward target</p>
	<p class="stat">0%</p>
</section>
