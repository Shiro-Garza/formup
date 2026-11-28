
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

	activeAccount = $state(null);
	initialized = $state(false);

	// Server synchronization state.
	syncing = $state(false);
	syncError = $state('');
	savingAttempt = $state(false);

	syncingWorkouts = $state(false);
	workoutError = $state('');
	savingWorkout = $state(false);

	syncController = null;
	workoutController = null;
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

		this.syncing = false;
		this.syncError = '';
		this.savingAttempt = false;

		this.syncingWorkouts = false;
		this.workoutError = '';
		this.savingWorkout = false;
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

		this.workoutController?.abort();
		this.workoutController = null;

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

			}

		} catch {
			// Ignore corrupt or unavailable browser storage.
		}

		// Move workouts logged before signing in into this account.
		if (account !== 'guest') {
			const claimed = this.takeGuestWorkouts();

			if (claimed.length) {
				if (account.startsWith('cadet:')) {
					void this.uploadWorkouts(claimed);
				} else {
					this.workouts = this.mergeWorkouts(
						this.workouts,
						claimed
					);

					this.save();
				}
			}
		}

		// Automatically retrieve the cadet's server records.
		if (account.startsWith('cadet:')) {
			void this.syncAttempts();
			void this.syncWorkouts();
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
					// The server is the source of truth for
					// authenticated cadet workouts too.
					workouts: this.activeAccount.startsWith(
						'cadet:'
					)
						? []
						: this.workouts,

					// The server is the source of truth
					// for authenticated cadet assessments.
					attempts: this.activeAccount.startsWith('cadet:')
						? []
						: this.attempts,

					target: this.target
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

	// Merge workout lists without duplicating ids.
	mergeWorkouts(current, incoming) {
		const byId = new Map();

		for (const workout of [...current, ...incoming]) {
			if (workout?.id) byId.set(workout.id, workout);
		}

		return [...byId.values()].sort(byDateDesc);
	}

	// Move workouts logged before signing in out of the guest bucket.
	takeGuestWorkouts() {
		if (!browser) return [];

		try {
			const raw = localStorage.getItem(
				KEY_PREFIX + 'guest'
			);

			if (!raw) return [];

			const saved = JSON.parse(raw);
			const workouts = Array.isArray(saved.workouts)
				? saved.workouts
				: [];

			const seedIds = new Set(
				SEED_WORKOUTS.map((w) => w.id)
			);

			// Demo data is not worth carrying into a real account.
			const claimed = workouts.filter(
				(w) => w?.id && !seedIds.has(w.id)
			);

			if (!claimed.length) return [];

			localStorage.setItem(
				KEY_PREFIX + 'guest',
				JSON.stringify({
					...saved,
					workouts: workouts.filter((w) =>
						seedIds.has(w.id)
					)
				})
			);

			return claimed;

		} catch {
			return [];
		}
	}

	// Upload workouts claimed from the guest session.
	async uploadWorkouts(workouts) {
		for (const workout of workouts) {
			const response = await fetch('/api/workouts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(workout)
			}).catch(() => null);

			if (!response?.ok) return;
		}

		await this.syncWorkouts();
	}

	// Save a workout. Cadets store workouts on the server.
	async submitWorkout(workout) {
		if (!browser || !this.initialized) {
			throw new Error(
				'Fitness records are not ready yet.'
			);
		}

		// Guests and administrators keep workouts on this device.
		if (!this.isCadet) {
			this.addLocalWorkout(workout);
			return true;
		}

		if (this.savingWorkout) {
			return false;
		}

		const account = this.activeAccount;
		const version = this.accountVersion;

		this.savingWorkout = true;
		this.workoutError = '';

		try {
			const response = await fetch('/api/workouts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(workout)
			});

			const result = await response
				.json()
				.catch(() => null);

			if (
				this.activeAccount !== account ||
				this.accountVersion !== version
			) {
				return false;
			}

			if (!response.ok || !result?.workout?.id) {
				throw new Error(
					result?.message ||
						'Unable to save the workout.'
				);
			}

			// Use the server-generated ID.
			this.workouts = this.mergeWorkouts(
				this.workouts,
				[result.workout]
			);

			return true;

		} catch (err) {
			if (
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.workoutError =
					err instanceof Error
						? err.message
						: 'Unable to save the workout.';

				throw err;
			}

			return false;

		} finally {
			if (
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.savingWorkout = false;
			}
		}
	}

	// Save a workout on this device only.
	addLocalWorkout(workout) {
		this.workouts = this.mergeWorkouts(this.workouts, [
			{
				id: crypto.randomUUID(),
				createdAt: new Date().toISOString(),
				...workout
			}
		]);

		this.save();
	}

	// Retrieve the current cadet's workouts.
	async syncWorkouts() {
		if (
			!browser ||
			!this.initialized ||
			!this.isCadet ||
			this.savingWorkout
		) {
			return false;
		}

		this.workoutController?.abort();

		const controller = new AbortController();
		this.workoutController = controller;

		const account = this.activeAccount;
		const version = this.accountVersion;

		this.syncingWorkouts = true;
		this.workoutError = '';

		try {
			const response = await fetch('/api/workouts', {
				method: 'GET',
				cache: 'no-store',
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error(
					'Unable to retrieve workouts.'
				);
			}

			const result = await response.json();

			if (
				controller.signal.aborted ||
				this.activeAccount !== account ||
				this.accountVersion !== version
			) {
				return false;
			}

			if (!Array.isArray(result.workouts)) {
				throw new Error(
					'Invalid workout data received.'
				);
			}

			this.workouts = this.mergeWorkouts(
				this.workouts,
				result.workouts
			);

			return true;

		} catch (err) {
			if (
				!controller.signal.aborted &&
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.workoutError =
					err instanceof Error
						? err.message
						: 'Unable to synchronize workouts.';
			}

			return false;

		} finally {
			if (
				this.workoutController === controller &&
				this.accountVersion === version
			) {
				this.workoutController = null;
				this.syncingWorkouts = false;
			}
		}
	}

	// Delete a workout.
	async deleteWorkout(id) {
		if (!browser) return false;

		if (!this.isCadet) {
			this.workouts = this.workouts.filter(
				(w) => w.id !== id
			);

			this.save();

			return true;
		}

		try {
			const response = await fetch(
				`/api/workouts?id=${encodeURIComponent(id)}`,
				{ method: 'DELETE' }
			);

			const result = await response
				.json()
				.catch(() => null);

			if (!response.ok) {
				throw new Error(
					result?.message ||
						'Unable to delete the workout.'
				);
			}

			this.workouts = this.workouts.filter(
				(w) => w.id !== id
			);

			return true;

		} catch (err) {
			this.workoutError =
				err instanceof Error
					? err.message
					: 'Unable to delete the workout.';

			return false;
		}
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

	// Update a saved assessment.
	async updateAttempt(id, attempt) {
		if (!browser || !this.initialized) {
			throw new Error(
				'Fitness records are not ready yet.'
			);
		}

		if (this.isAdmin) {
			throw new Error(
				'Administrators cannot change cadet assessments.'
			);
		}

		// Guest assessments stay on this device.
		if (!this.isCadet) {
			if (!this.attempts.some((a) => a.id === id)) {
				return false;
			}

			this.attempts = this.attempts
				.map((a) =>
					a.id === id
						? {
							...a,
							date: attempt.date,
							results: attempt.results,
							updatedAt: new Date().toISOString()
						}
						: a
				)
				.sort(byDateAsc);

			this.save();

			return true;
		}

		if (this.savingAttempt) {
			return false;
		}

		const account = this.activeAccount;
		const version = this.accountVersion;

		this.savingAttempt = true;
		this.syncError = '';

		try {
			const response = await fetch(
				`/api/attempts/${encodeURIComponent(id)}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(attempt)
				}
			);

			const result = await response
				.json()
				.catch(() => null);

			if (
				this.activeAccount !== account ||
				this.accountVersion !== version
			) {
				return false;
			}

			if (!response.ok || !result?.attempt?.id) {
				throw new Error(
					result?.message ||
						'Unable to update the assessment.'
				);
			}

			this.attempts = this.attempts
				.map((a) =>
					a.id === id ? result.attempt : a
				)
				.sort(byDateAsc);

			return true;

		} catch (err) {
			if (
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.syncError =
					err instanceof Error
						? err.message
						: 'Unable to update the assessment.';

				throw err;
			}

			return false;

		} finally {
			if (
				this.activeAccount === account &&
				this.accountVersion === version
			) {
				this.savingAttempt = false;
			}
		}
	}

	// Remove a saved assessment.
	async deleteAttempt(id) {
		if (!browser || !this.initialized) {
			throw new Error(
				'Fitness records are not ready yet.'
			);
		}

		if (this.isAdmin) {
			throw new Error(
				'Administrators cannot change cadet assessments.'
			);
		}

		if (!this.isCadet) {
			this.attempts = this.attempts.filter(
				(a) => a.id !== id
			);

			this.save();

			return true;
		}

		try {
			const response = await fetch(
				`/api/attempts/${encodeURIComponent(id)}`,
				{ method: 'DELETE' }
			);

			const result = await response
				.json()
				.catch(() => null);

			if (!response.ok) {
				throw new Error(
					result?.message ||
						'Unable to delete the assessment.'
				);
			}

			this.attempts = this.attempts.filter(
				(a) => a.id !== id
			);

			return true;

		} catch (err) {
			this.syncError =
				err instanceof Error
					? err.message
					: 'Unable to delete the assessment.';

			return false;
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

}

export const store = new FormUpStore();
