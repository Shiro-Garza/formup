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
    border: none;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    max-width: 380px;
    width: 90%;
    font-family: system-ui, sans-serif;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
  }

  .modal-content {
    padding: 2rem;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 14px;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #64748b;
  }

  h2 {
    margin-top: 0;
    font-size: 1.5rem;
  }

  .field {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .submit-btn {
    width: 100%;
    padding: 0.75rem;
    background-color: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    background-color: #fee2e2;
    color: #b91c1c;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
</style>
