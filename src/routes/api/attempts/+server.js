import { error, json } from '@sveltejs/kit';
import { update } from '#lib/server/db.js';
import { EVENTS } from '#lib/events.js';

// Logged-in users save their assessment attempts here so admins can see them.
export async function POST({ request, locals }) {
	if (!locals.user) error(401, 'Log in to sync results.');

	const body = await request.json().catch(() => null);
	const date = body?.date;
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) error(400, 'Invalid date.');

	const results = {};
	for (const e of EVENTS) {
		const v = Number(body?.results?.[e.id]);
		if (!(v > 0) || v > 100000) error(400, `Invalid result for ${e.label}.`);
		results[e.id] = v;
	}

	await update((db) => {
		db.attempts.push({
			id: crypto.randomUUID(),
			email: locals.user.email,
			date,
			results,
			createdAt: new Date().toISOString()
		});
	});

	return json({ ok: true });
}
