<script>
  import { enhance } from '$app/forms';

  let { open = $bindable(false), form } = $props();
  let dialog = $state();
  let loading = $state(false);

  // Sync the HTML dialog open/close state with the Svelte prop
  $effect(() => {
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  onclose={() => (open = false)}
  onclick={(e) => {
    // Close when clicking the dark backdrop outside the box
    if (e.target === dialog) open = false;
  }}
>
  <div class="modal-content">
    <button type="button" class="close-btn" onclick={() => (open = false)} aria-label="Close">
      &times;
    </button>

    <form
      method="POST"
      action="?/login"
      use:enhance={() => {
        loading = true;
        return async ({ result, update }) => {
          await update();
          loading = false;
          // Close the modal automatically if login succeeds
          if (result.type === 'redirect' || result.type === 'success') {
            open = false;
          }
        };
      }}
    >
      <h2>Sign In</h2>

      {#if form?.message}
        <p class="error">{form.message}</p>
      {/if}

      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value={form?.email ?? ''} required />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required />
      </div>

      <button type="submit" class="submit-btn" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  </div>
</dialog>

<style>
  dialog {
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-card);
    color: var(--color-text);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
    max-width: 380px;
    width: 90%;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
  }

  .modal-content {
    padding: var(--space-6);
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: var(--space-2);
    right: var(--space-3);
    min-width: var(--touch-target);
    min-height: var(--touch-target);
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-muted);
  }

  h2 {
    margin-bottom: var(--space-4);
  }

  .field {
    margin-bottom: var(--space-4);
  }

  label {
    display: block;
    margin-bottom: var(--space-2);
    font-weight: 500;
  }

  input {
    width: 100%;
    min-height: var(--touch-target);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-control);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
  }

  input:focus-visible,
  .close-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .submit-btn {
    width: 100%;
    min-height: var(--touch-target);
    background: var(--color-accent);
    color: var(--color-on-accent);
    border: none;
    border-radius: var(--radius-control);
    font-weight: 600;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    background: rgba(255, 90, 90, 0.15);
    color: #ff8a8a;
    padding: var(--space-3);
    border-radius: var(--radius-control);
    margin-bottom: var(--space-4);
    font-size: 0.9rem;
  }
</style>
