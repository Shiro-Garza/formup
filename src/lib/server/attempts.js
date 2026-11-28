import { error } from '@sveltejs/kit';
import { EVENTS } from '#lib/events.js';

// Return assessment information without exposing account data.
export function publicAttempt(attempt) {
	return {
		id: attempt.id,
		date: attempt.date,
		results: attempt.results,
		createdAt: attempt.createdAt,
		updatedAt: attempt.updatedAt ?? null
	};
}

// Validate an assessment payload. Throws a 400 error when it is invalid.
export function readAttempt(body) {
	const date = body?.date;

	if (
		typeof date !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}$/.test(date)
	) {
		error(400, 'Invalid date.');
	}

	const parsedDate = new Date(
		`${date}T00:00:00Z`
	);

	if (
		Number.isNaN(parsedDate.getTime()) ||
		parsedDate.toISOString().slice(0, 10) !== date
	) {
		error(400, 'Enter a valid assessment date.');
	}

	if (date > new Date().toISOString().slice(0, 10)) {
		error(400, 'Assessment dates cannot be in the future.');
	}

	// Validate individual event results.
	const results = {};

	for (const e of EVENTS) {
		const raw = body?.results?.[e.id];

		if (
			typeof raw !== 'number' &&
			typeof raw !== 'string'
		) {
			error(400, `Invalid result for ${e.label}.`);
		}

		const value = Number(raw);

		if (
			!Number.isFinite(value) ||
			value <= 0 ||
			value > 100000
		) {
			error(400, `Invalid result for ${e.label}.`);
		}

		// Repetition-based events must use whole numbers.
		if (
			e.kind !== 'time' &&
			!Number.isInteger(value)
		) {
			error(
				400,
				`${e.label} must be a whole number.`
			);
		}

		results[e.id] = value;
	}

	return { date, results };
}
