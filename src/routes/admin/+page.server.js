import { error, fail, redirect } from '@sveltejs/kit';
import { getDb, update, sortSessions } from '#lib/server/db.js';
import { getUsers } from '#lib/server/auth.js';

function requireAdmin(locals) {
	if (!locals.user) redirect(303, '/');
	if (locals.user.role !== 'admin') error(403, 'Admins only.');
}

export async function load({ locals }) {
	requireAdmin(locals);

	const db = await getDb();
	const users = (await getUsers()).filter((u) => u.role !== 'admin');

	// Everyone's attempts, oldest first. Passwords never leave the server.
	const roster = users.map((u) => ({
		name: u.name,
		email: u.email,
		attempts: db.attempts
			.filter((a) => a.email === u.email)
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((a) => ({ id: a.id, date: a.date, results: a.results }))
	}));

	return { roster };
}

export const actions = {
	addSession: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const date = form.get('date')?.toString() ?? '';
		const time = form.get('time')?.toString() ?? '';
		const title = form.get('title')?.toString().trim() ?? '';
		const detail = form.get('detail')?.toString().trim() ?? '';

		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, { message: 'Pick a date.' });
		if (!/^\d{2}:\d{2}$/.test(time)) return fail(400, { message: 'Pick a start time.' });
		if (!title) return fail(400, { message: 'Enter a session title.' });

		await update((db) => {
			db.sessions.push({
				id: crypto.randomUUID(),
				date,
				time,
				title: title.slice(0, 80),
				detail: detail.slice(0, 200)
			});
			sortSessions(db.sessions);
		});
		return { ok: true };
	},

	deleteSession: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = (await request.formData()).get('id')?.toString();
		await update((db) => {
			db.sessions = db.sessions.filter((s) => s.id !== id);
		});
		return { ok: true };
	}
};
