import { error, json } from '@sveltejs/kit';
import { getDb, update } from '#lib/server/db.js';
import { EVENTS } from '#lib/events.js';
import { publicAttempt, readAttempt } from '#lib/server/attempts.js';

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

	const { date, results } = readAttempt(
		await request.json().catch(() => null)
	);

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
			createdAt: new Date().toISOString(),
			updatedAt: null
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
