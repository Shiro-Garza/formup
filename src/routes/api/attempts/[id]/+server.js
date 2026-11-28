import { error, json } from '@sveltejs/kit';
import { update } from '#lib/server/db.js';
import { EVENTS } from '#lib/events.js';
import { publicAttempt, readAttempt } from '#lib/server/attempts.js';

// Require an authenticated cadet.
function requireCadet(locals) {
	if (!locals.user) {
		error(401, 'Log in to change your assessments.');
	}

	if (locals.user.role === 'admin') {
		error(403, 'Administrators cannot change cadet assessments.');
	}

	return locals.user;
}

// Update an existing assessment.
export async function PATCH({ params, request, locals }) {
	const user = requireCadet(locals);
	const email = user.email.trim().toLowerCase();

	const { date, results } = readAttempt(
		await request.json().catch(() => null)
	);

	const outcome = await update((db) => {
		db.attempts ??= [];

		const attempt = db.attempts.find(
			(a) =>
				a.id === params.id &&
				a.email?.trim().toLowerCase() === email
		);

		if (!attempt) {
			return 'missing';
		}

		// Refuse to turn this record into a duplicate of another one.
		const duplicate = db.attempts.find(
			(a) =>
				a.id !== attempt.id &&
				a.email?.trim().toLowerCase() === email &&
				a.date === date &&
				EVENTS.every(
					(e) =>
						Number(a.results?.[e.id]) ===
						results[e.id]
				)
		);

		if (duplicate) {
			return 'duplicate';
		}

		Object.assign(attempt, {
			date,
			results,
			updatedAt: new Date().toISOString()
		});

		return { attempt };
	});

	if (outcome === 'missing') {
		error(404, 'Assessment not found.');
	}

	if (outcome === 'duplicate') {
		error(
			409,
			'An identical assessment already exists.'
		);
	}

	return json(
		{
			ok: true,
			attempt: publicAttempt(outcome.attempt),
			message: 'Assessment updated successfully.'
		},
		{
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}

// Delete an existing assessment.
export async function DELETE({ params, locals }) {
	const user = requireCadet(locals);
	const email = user.email.trim().toLowerCase();

	const deleted = await update((db) => {
		db.attempts ??= [];

		const originalLength = db.attempts.length;

		db.attempts = db.attempts.filter(
			(a) =>
				!(
					a.id === params.id &&
					a.email?.trim().toLowerCase() === email
				)
		);

		return db.attempts.length < originalLength;
	});

	if (!deleted) {
		error(404, 'Assessment not found.');
	}

	return json(
		{
			ok: true,
			message: 'Assessment deleted successfully.'
		},
		{
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}
