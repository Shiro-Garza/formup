import { browser } from '$app/environment';
import { SEED_WORKOUTS, SEED_ATTEMPTS, compositeScore } from './events.js';

const KEY = 'formup:v1';

const byDateDesc = (a, b) => b.date.localeCompare(a.date);
const byDateAsc = (a, b) => a.date.localeCompare(b.date);

class FormUpStore {
	workouts = $state(SEED_WORKOUTS.map((w) => ({ ...w })));
	attempts = $state(SEED_ATTEMPTS.map((a) => ({ ...a, results: { ...a.results } })));
	target = $state(100);
	attended = $state([]);

	latest = $derived(this.attempts.at(-1) ?? null);
	previous = $derived(this.attempts.at(-2) ?? null);
	composite = $derived(this.latest ? compositeScore(this.latest.results) : 0);
	delta = $derived(
		this.latest && this.previous ? this.composite - compositeScore(this.previous.results) : null
	);

	// Load saved data from this browser (call once from onMount).
	init() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(KEY);
			if (!raw) return;
			const saved = JSON.parse(raw);
			if (Array.isArray(saved.workouts)) this.workouts = saved.workouts;
			if (Array.isArray(saved.attempts)) this.attempts = saved.attempts;
			if (typeof saved.target === 'number') this.target = saved.target;
			if (Array.isArray(saved.attended)) this.attended = saved.attended;
		} catch {
			// ignore corrupt or unavailable storage
		}
	}

	save() {
		if (!browser) return;
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify({
					workouts: this.workouts,
					attempts: this.attempts,
					target: this.target,
					attended: this.attended
				})
			);
		} catch {
			// storage full or blocked; keep working in memory
		}
	}

	addWorkout(workout) {
		this.workouts = [{ id: crypto.randomUUID(), ...workout }, ...this.workouts].sort(byDateDesc);
		this.save();
	}

	deleteWorkout(id) {
		this.workouts = this.workouts.filter((w) => w.id !== id);
		this.save();
	}

	addAttempt(attempt) {
		this.attempts = [...this.attempts, { id: crypto.randomUUID(), ...attempt }].sort(byDateAsc);
		this.save();
	}

	setTarget(value) {
		this.target = value;
		this.save();
	}

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
