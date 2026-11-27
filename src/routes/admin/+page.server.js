import { error, fail, redirect } from '@sveltejs/kit';
import { getDb, update, sortSessions } from '#lib/server/db.js';
import { getUsers } from '#lib/server/auth.js';

// Require administrator access.
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

// Load administrator dashboard data.
export async function load({ locals }) {
	requireAdmin(locals);

	const db = await getDb();
	const users = (await getUsers()).filter((u) => u.role !== 'admin');

	// Existing PFA roster.
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

	// Cadet roster for attendance management.
	const attendanceRoster = users
		.map((u) => ({
			name: u.name,
			email: u.email
		}))
		.sort((a, b) =>
			(a.name || a.email).localeCompare(b.name || b.email)
		);

	// Attendance records for all PT sessions.
	const attendance = db.attendance.map((a) => ({
		id: a.id,
		sessionId: a.sessionId,
		email: a.email,
		checkedInAt: a.checkedInAt,
		source: a.source ?? 'cadet'
	}));

	return {
		roster,
		attendanceRoster,
		attendance
	};
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

			// Keep the original session ID and attendance records.
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

			if (db.sessions.length === originalLength) {
				return false;
			}

			// Remove attendance associated with the deleted session.
			db.attendance = db.attendance.filter(
				(a) => a.sessionId !== id
			);

			return true;
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
	},

	// Administrator manually marks a cadet present.
	markPresent: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString();
		const email = form.get('email')?.toString().trim().toLowerCase();

		if (!sessionId || !email) {
			return fail(400, {
				message: 'Select a PT session and cadet.'
			});
		}

		const users = await getUsers();

		const cadet = users.find(
			(u) =>
				u.email.toLowerCase() === email &&
				u.role !== 'admin'
		);

		if (!cadet) {
			return fail(404, {
				message: 'Cadet not found.'
			});
		}

		const result = await update((db) => {
			const session = db.sessions.find(
				(s) => s.id === sessionId
			);

			if (!session) {
				return 'missing';
			}

			// Prevent attendance for future sessions
			// before the check-in window opens.
			const start = new Date(
				`${session.date}T${session.time}:00`
			).getTime();

			if (Number.isNaN(start)) {
				return 'invalid';
			}

			const opensAt = start - 15 * 60 * 1000;

			if (Date.now() < opensAt) {
				return 'early';
			}

			// Prevent duplicate attendance records.
			const existing = db.attendance.find(
				(a) =>
					a.sessionId === sessionId &&
					a.email.toLowerCase() === email
			);

			if (existing) {
				return 'duplicate';
			}

			db.attendance.push({
				id: crypto.randomUUID(),
				sessionId,
				email: cadet.email,
				checkedInAt: new Date().toISOString(),
				source: 'admin',
				recordedBy: locals.user.email
			});

			return 'success';
		});

		if (result === 'missing') {
			return fail(404, {
				message: 'PT session not found.'
			});
		}

		if (result === 'invalid') {
			return fail(400, {
				message: 'Invalid PT session time.'
			});
		}

		if (result === 'early') {
			return fail(400, {
				message: 'Attendance has not opened for this session.'
			});
		}

		if (result === 'duplicate') {
			return {
				ok: true,
				success: 'Cadet attendance is already recorded.'
			};
		}

		return {
			ok: true,
			success: 'Cadet marked present successfully.'
		};
	},

	// Administrator removes an incorrect attendance record.
	removeAttendance: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString();
		const email = form.get('email')?.toString().trim().toLowerCase();

		if (!sessionId || !email) {
			return fail(400, {
				message: 'Select a PT session and cadet.'
			});
		}

		const removed = await update((db) => {
			const originalLength = db.attendance.length;

			db.attendance = db.attendance.filter(
				(a) =>
					!(
						a.sessionId === sessionId &&
						a.email.toLowerCase() === email
					)
			);

			return db.attendance.length < originalLength;
		});

		if (!removed) {
			return fail(404, {
				message: 'Attendance record not found.'
			});
		}

		return {
			ok: true,
			success: 'Attendance record removed successfully.'
		};
	}
};
