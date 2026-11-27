
import { browser } from '$app/environment';
import {
	SEED_WORKOUTS,
	SEED_ATTEMPTS,
	compositeScore
} from './events.js';

const KEY_PREFIX = 'formup:v2:';

const byDateDesc = (a, b) =>
	b.date.localeCompare(a.date);

const byDateAsc = (a, b) =>
	a.date.localeCompare(b.date) ||
	(a.createdAt ?? '').localeCompare(b.createdAt ?? '');

class FormUpStore {
	// Account-specific fitness data.
	workouts = $state([]);
	attempts = $state([]);
	target = $state(100);
	attended = $state([]);

	activeAccount = $state(null);
	initialized = $state(false);

	// Server synchronization state.
	syncing = $state(false);
	syncError = $state('');
	savingAttempt = $state(false);

	syncController = null;
	accountVersion = 0;

	// PFA calculations.
	latest = $derived(
		this.attempts.at(-1) ?? null
	);

	previous = $derived(
		this.attempts.at(-2) ?? null
	);

	composite = $derived(
		this.latest
			? compositeScore(this.latest.results)
			: 0
	);

	delta = $derived(
		this.latest && this.previous
			? this.composite -
				compositeScore(this.previous.results)
			: null
	);

	// Current account type.
	isCadet = $derived(
		this.activeAccount?.startsWith('cadet:') ?? false
	);

	isAdmin = $derived(
		this.activeAccount?.startsWith('admin:') ?? false
	);

	// Generate an account-specific storage key.
	getAccountKey(user) {
		if (!user?.email) {
			return 'guest';
		}

		return `${user.role === 'admin' ? 'admin' : 'cadet'}:${user.email.trim().toLowerCase()}`;
	}

	// Reset data when switching accounts.
	reset(useDemoData = false) {
		this.workouts = useDemoData
			? SEED_WORKOUTS.map((w) => ({ ...w }))
			: [];

		this.attempts = useDemoData
			? SEED_ATTEMPTS.map((a) => ({
				...a,
				results: { ...a.results }
			}))
			: [];

		this.target = 100;
		this.attended = [];

		this.syncing = false;
		this.syncError = '';
		this.savingAttempt = false;
	}

	// Load the active account.
	init(user = null) {
		if (!browser) return;

		const account = this.getAccountKey(user);

		if (
			this.initialized &&
			this.activeAccount === account
		) {
			return;
		}

		// Cancel synchronization from the previous account.
		this.syncController?.abort();
		this.syncController = null;

		// Invalidate requests belonging to the old account.
		this.accountVersion += 1;

		// Preserve the previous account's local data.
		if (this.initialized) {
			this.save();
		}

		this.activeAccount = account;
		this.initialized = true;

		// Demo data belongs only to guests.
		this.reset(account === 'guest');

		try {
			const raw = localStorage.getItem(
				KEY_PREFIX + account
			);

			if (raw) {
				const saved = JSON.parse(raw);

				if (Array.isArray(saved.workouts)) {
					this.workouts =
						saved.workouts.sort(byDateDesc);
				}

				// Cadets retrieve PFA records from the server.
				// Guests and administrators use local records.
				if (
					!account.startsWith('cadet:') &&
					Array.isArray(saved.attempts)
				) {
					this.attempts =
						saved.attempts.sort(byDateAsc);
				}

				if (
					typeof saved.target === 'number' &&
					Number.isFinite(saved.target) &&
					saved.target > 0 &&
					saved.target <= 100
				) {
					this.target = saved.target;
				}

				if (Array.isArray(saved.attended)) {
					this.attended = saved.attended;
				}
			}

		} catch {
			// Ignore corrupt or unavailable browser storage.
		}

		// Automatically retrieve the cadet's server records.
		if (account.startsWith('cadet:')) {
			void this.syncAttempts();
		}
	}

	// Save account-specific local data.
	save() {
		if (
			!browser ||
			!this.initialized ||
			!this.activeAccount
		) {
			return;
		}

		try {
			localStorage.setItem(
				KEY_PREFIX + this.activeAccount,
				JSON.stringify({
					workouts: this.workouts,

					// The server is the source of truth
					// for authenticated cadet assessments.
					attempts: this.activeAccount.startsWith('cadet:')
						? []
						: this.attempts,

					target: this.target,
					attended: this.attended
				})
			);

		} catch {
			// Continue working if storage is unavailable.
		}
	}

	// Retrieve the current cadet's PFA history.
	async syncAttempts() {
		if (
			!browser ||
			!this.initialized ||
			!this.isCadet ||
			this.savingAttempt
		) {
			return false;
		}

		// Cancel any previous synchronization request.
		this.syncController?.abort();

		const controller = new AbortController();
		this.syncController = controller;

		const account = this.activeAccount;
		const version = this.accountVersion;

		this.syncing = true;
		this.syncError = '';

		try {
			const response = await fetch('/api/attempts', {
				method: 'GET',
				cache: 'no-store',
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error(
					'Unable to retrieve PFA assessments.'
				);
			}

			const result = await response.json();

			// Ignore outdated requests after account switching.
			if (
				controller.signal.aborted ||
				this.activeAccount !== account ||
				this.accountVersion !== version
			) {
				return false;
			}

			if (!Array.isArray(result.attempts)) {
				throw new Error(
					'Invalid assessment data received.'
				);
			}

			// Prevent duplicate records using server IDs.
			const unique = new Map();

			for (const attempt of result.attempts) {
				if (
					attempt?.id &&
					typeof attempt.date === 'string' &&
					attempt.results
				) {
					unique.set(attempt.id, attempt);
				}
			}

			// Replace the list rather than append to it.
			this.attempts = [
				...unique.values()
			].sort(byDateAsc);

			this.save();

			return true;

		} catch (err) {
			if (
				!controller.signal.aborted &&
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.syncError =
					err instanceof Error
						? err.message
						: 'Unable to synchronize assessments.';
			}

			return false;

		} finally {
			if (
				this.syncController === controller &&
				this.accountVersion === version
			) {
				this.syncController = null;
				this.syncing = false;
			}
		}
	}

	// Add a workout.
	addWorkout(workout) {
		this.workouts = [
			{
				id: crypto.randomUUID(),
				...workout
			},
			...this.workouts
		].sort(byDateDesc);

		this.save();
	}

	// Delete a workout.
	deleteWorkout(id) {
		this.workouts = this.workouts.filter(
			(w) => w.id !== id
		);

		this.save();
	}

	// Save guest assessments locally.
	// Cadet assessments must use submitAttempt().
	addAttempt(attempt) {
		if (!this.initialized || this.isCadet || this.isAdmin) {
			return false;
		}

		this.attempts = [
			...this.attempts,
			{
				...attempt,
				id: crypto.randomUUID(),
				createdAt: new Date().toISOString()
			}
		].sort(byDateAsc);

		this.save();

		return true;
	}

	// Submit an assessment to the server.
	async submitAttempt(attempt) {
		if (!browser || !this.initialized) {
			throw new Error(
				'Fitness records are not ready yet.'
			);
		}

		if (this.isAdmin) {
			throw new Error(
				'Administrators cannot submit cadet assessments.'
			);
		}

		// Guests can continue using the demo locally.
		if (!this.isCadet) {
			this.addAttempt(attempt);
			return true;
		}

		// Prevent repeated submissions.
		if (this.savingAttempt) {
			return false;
		}

		// Avoid a retrieval request overwriting a new result.
		this.syncController?.abort();
		this.syncController = null;
		this.syncing = false;

		const account = this.activeAccount;
		const version = this.accountVersion;

		this.savingAttempt = true;
		this.syncError = '';

		try {
			const response = await fetch('/api/attempts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					date: attempt.date,
					results: attempt.results
				})
			});

			const result = await response
				.json()
				.catch(() => null);

			// Prevent old responses from affecting another account.
			if (
				this.activeAccount !== account ||
				this.accountVersion !== version
			) {
				return false;
			}

			if (!response.ok || !result?.attempt?.id) {
				throw new Error(
					result?.message ||
					'Unable to save the assessment. Please check your records before retrying.'
				);
			}

			// Use the server-generated ID.
			const savedAttempt = result.attempt;

			this.attempts = [
				...this.attempts.filter(
					(a) => a.id !== savedAttempt.id
				),
				savedAttempt
			].sort(byDateAsc);

			this.save();

			return true;

		} catch (err) {
			if (
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.syncError =
					err instanceof Error
						? err.message
						: 'Unable to save the assessment.';

				throw err;
			}

			return false;

		} finally {
			if (
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.savingAttempt = false;

				// Refresh the complete history after submission.
				void this.syncAttempts();
			}
		}
	}

	// Update the personal fitness target.
	setTarget(value) {
		if (
			typeof value !== 'number' ||
			!Number.isFinite(value) ||
			value <= 0 ||
			value > 100
		) {
			return;
		}

		this.target = value;
		this.save();
	}

	// Legacy attendance helpers.
	// Actual PT check-in is handled by the server API.
	isAttended(key) {
		return this.attended.includes(key);
	}

	toggleAttended(key) {
		this.attended = this.isAttended(key)
			? this.attended.filter((k) => k !== key)
			: [...this.attended, key];

		this.save();
	}
}

export const store = new FormUpStore();
