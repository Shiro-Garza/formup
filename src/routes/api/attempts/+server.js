
import { error, json } from '@sveltejs/kit';
import { getDb, update } from '#lib/server/db.js';
import { EVENTS } from '#lib/events.js';

// Return assessment information without exposing account data.
function publicAttempt(attempt) {
	return {
		id: attempt.id,
		date: attempt.date,
		results: attempt.results,
		createdAt: attempt.createdAt
	};
}

// Retrieve the logged-in cadet's assessment history.
export async function GET({ locals }) {
	if (!locals.user) {
		error(401, 'Log in to view your assessments.');
	}

	if (locals.user.role === 'admin') {
		error(
			403,
			'Administrators cannot retrieve personal cadet assessments.'
		);
	}

	const email = locals.user.email.trim().toLowerCase();

	const db = await getDb();

	const attempts = (db.attempts ?? [])
		.filter(
			(a) => a.email?.trim().toLowerCase() === email
		)
		.sort((a, b) =>
			a.date.localeCompare(b.date) ||
			(a.createdAt ?? '').localeCompare(
				b.createdAt ?? ''
			)
		)
		.map(publicAttempt);

	return json(
		{ attempts },
		{
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}

// Save a new PFA assessment.
export async function POST({ request, locals }) {
	// Authentication and authorization.
	if (!locals.user) {
		error(401, 'Log in to sync results.');
	}

	if (locals.user.role === 'admin') {
		error(
			403,
			'Administrators cannot submit cadet assessments.'
		);
	}

	const email = locals.user.email.trim().toLowerCase();

	const body = await request.json().catch(() => null);

	const date = body?.date;

	// Validate the assessment date.
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

	// Check for duplicates and save inside the same
	// serialized database update.
	const outcome = await update((db) => {
		db.attempts ??= [];

		const existing = db.attempts.find((a) => {
			// Only compare records belonging to this cadet.
			if (
				a.email?.trim().toLowerCase() !== email
			) {
				return false;
			}

			// Assessments must have the same date.
			if (a.date !== date) {
				return false;
			}

			// Every event result must match.
			return EVENTS.every(
				(e) =>
					Number(a.results?.[e.id]) ===
					results[e.id]
			);
		});

		// Return the existing assessment instead of
		// creating another identical record.
		if (existing) {
			return {
				attempt: existing,
				duplicate: true
			};
		}

		// Create a new assessment.
		const attempt = {
			id: crypto.randomUUID(),
			email,
			date,
			results,
			createdAt: new Date().toISOString()
		};

		db.attempts.push(attempt);

		return {
			attempt,
			duplicate: false
		};
	});

	// Return the saved or existing assessment.
	return json(
		{
			ok: true,
			duplicate: outcome.duplicate,
			attempt: publicAttempt(outcome.attempt),
			message: outcome.duplicate
				? 'This assessment is already recorded. No duplicate was created.'
				: 'Assessment saved successfully.'
		},
		{
			status: outcome.duplicate ? 200 : 201,
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}
