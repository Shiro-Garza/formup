
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb, update, sortSessions } from '#lib/server/db.js';
import { getUsers } from '#lib/server/auth.js';

function requireAdmin(locals) {
	if (!locals.user) redirect(303, '/');
	if (locals.user.role !== 'admin') error(403, 'Admins only.');
}

// Read session information from a submitted form.
function readSession(form) {
	return {
		date: form.get('date')?.toString() ?? '',
		time: form.get('time')?.toString() ?? '',
		title: form.get('title')?.toString().trim().slice(0, 80) ?? '',
		detail: form.get('detail')?.toString().trim().slice(0, 200) ?? '',
		location: form.get('location')?.toString().trim().slice(0, 120) ?? ''
	};
}

// Validate session information.
function validateSession(session) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
		return 'Pick a date.';
	}

	const parsedDate = new Date(`${session.date}T00:00:00Z`);

	if (
		Number.isNaN(parsedDate.getTime()) ||
		parsedDate.toISOString().slice(0, 10) !== session.date
	) {
		return 'Enter a valid date.';
	}

	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(session.time)) {
		return 'Pick a valid start time.';
	}

	if (!session.title) {
		return 'Enter a session title.';
	}

	return null;
}

export async function load({ locals }) {
	requireAdmin(locals);

	const db = await getDb();
	const users = (await getUsers()).filter((u) => u.role !== 'admin');

	// Everyone's attempts, oldest first.
	// Passwords never leave the server.
	const roster = users.map((u) => ({
		name: u.name,
		email: u.email,
		attempts: db.attempts
			.filter((a) => a.email === u.email)
			.sort((a, b) => a.date.localeCompare(b.date))
			.map((a) => ({
				id: a.id,
				date: a.date,
				results: a.results
			}))
	}));

	return { roster };
}

export const actions = {
	// Create a new PT session.
	addSession: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const session = readSession(form);
		const message = validateSession(session);

		if (message) {
			return fail(400, { message });
		}

		await update((db) => {
			db.sessions.push({
				id: crypto.randomUUID(),
				...session
			});

			sortSessions(db.sessions);
		});

		return {
			ok: true,
			success: 'PT session added successfully.'
		};
	},

	// Edit an existing PT session.
	editSession: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const id = form.get('id')?.toString();
		const session = readSession(form);
		const message = validateSession(session);

		if (!id) {
			return fail(400, {
				message: 'No session selected.'
			});
		}

		if (message) {
			return fail(400, { message });
		}

		const updated = await update((db) => {
			const existing = db.sessions.find((s) => s.id === id);

			if (!existing) {
				return false;
			}

			// Update the session without changing its ID.
			Object.assign(existing, session);

			sortSessions(db.sessions);

			return true;
		});

		if (!updated) {
			return fail(404, {
				message: 'PT session not found.'
			});
		}

		return {
			ok: true,
			success: 'PT session updated successfully.'
		};
	},

	// Delete an existing PT session.
	deleteSession: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const id = form.get('id')?.toString();

		if (!id) {
			return fail(400, {
				message: 'No session selected.'
			});
		}

		const deleted = await update((db) => {
			const originalLength = db.sessions.length;

			db.sessions = db.sessions.filter((s) => s.id !== id);

			return db.sessions.length < originalLength;
		});

		if (!deleted) {
			return fail(404, {
				message: 'PT session not found.'
			});
		}

		return {
			ok: true,
			success: 'PT session deleted successfully.'
		};
	}
};
