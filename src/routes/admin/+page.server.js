import { error, fail, redirect } from '@sveltejs/kit';
import {
	getDb,
	update,
	sortSessions,
	sortAnnouncements
} from '#lib/server/db.js';
import { getUsers } from '#lib/server/auth.js';

// Require administrator access.
function requireAdmin(locals) {
	if (!locals.user) redirect(303, '/');
	if (locals.user.role !== 'admin') error(403, 'Admins only.');
}

// Read PT session information.
function readSession(form) {
	return {
		date: form.get('date')?.toString() ?? '',
		time: form.get('time')?.toString() ?? '',
		title: form.get('title')?.toString().trim().slice(0, 80) ?? '',
		detail: form.get('detail')?.toString().trim().slice(0, 200) ?? '',
		location: form.get('location')?.toString().trim().slice(0, 120) ?? ''
	};
}

// Validate PT session information.
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

// Read announcement information.
function readAnnouncement(form) {
	return {
		title: form.get('title')?.toString().trim() ?? '',
		message: form.get('message')?.toString().trim() ?? '',
		priority: form.get('priority')?.toString() ?? 'normal'
	};
}

// Validate announcement information.
function validateAnnouncement(announcement) {
	if (!announcement.title) {
		return 'Enter an announcement title.';
	}

	if (announcement.title.length > 80) {
		return 'The title must be 80 characters or fewer.';
	}

	if (!announcement.message) {
		return 'Enter an announcement message.';
	}

	if (announcement.message.length > 1000) {
		return 'The message must be 1000 characters or fewer.';
	}

	if (
		!['normal', 'important'].includes(announcement.priority)
	) {
		return 'Select a valid priority.';
	}

	return null;
}

// Generate a local calendar date.
function localDate(date = new Date()) {
	return `${date.getFullYear()}-${String(
		date.getMonth() + 1
	).padStart(2, '0')}-${String(
		date.getDate()
	).padStart(2, '0')}`;
}

// Load administrator dashboard data.
export async function load({ locals }) {
	requireAdmin(locals);

	const db = await getDb();
	const users = (await getUsers()).filter(
		(u) => u.role !== 'admin'
	);

	// Existing PFA roster.
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
			(a.name || a.email).localeCompare(
				b.name || b.email
			)
		);

	// Attendance records.
	const attendance = db.attendance.map((a) => ({
		id: a.id,
		sessionId: a.sessionId,
		email: a.email,
		checkedInAt: a.checkedInAt,
		source: a.source ?? 'cadet'
	}));

	// Published announcements.
	const announcements = sortAnnouncements(
		[...db.announcements]
	).map((a) => ({
		id: a.id,
		title: a.title,
		message: a.message,
		priority: a.priority,
		date: a.date,
		createdAt: a.createdAt,
		updatedAt: a.updatedAt
	}));

	return {
		roster,
		attendanceRoster,
		attendance,
		announcements
	};
}

export const actions = {
	// =====================================
	// PT SESSION MANAGEMENT
	// =====================================

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
			const existing = db.sessions.find(
				(s) => s.id === id
			);

			if (!existing) {
				return false;
			}

			// Preserve the session ID and attendance records.
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

			db.sessions = db.sessions.filter(
				(s) => s.id !== id
			);

			if (db.sessions.length === originalLength) {
				return false;
			}

			// Remove associated attendance records.
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

	// =====================================
	// ATTENDANCE MANAGEMENT
	// =====================================

	markPresent: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString();

		const email = form
			.get('email')
			?.toString()
			.trim()
			.toLowerCase();

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

	removeAttendance: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString();

		const email = form
			.get('email')
			?.toString()
			.trim()
			.toLowerCase();

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
	},

	// =====================================
	// ANNOUNCEMENT MANAGEMENT
	// =====================================

	// Publish a new announcement.
	addAnnouncement: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const announcement = readAnnouncement(form);
		const message = validateAnnouncement(announcement);

		if (message) {
			return fail(400, {
				message,
				section: 'announcements'
			});
		}

		const now = new Date();

		await update((db) => {
			db.announcements.push({
				id: crypto.randomUUID(),
				...announcement,
				date: localDate(now),
				createdAt: now.toISOString(),
				updatedAt: null
			});

			sortAnnouncements(db.announcements);
		});

		return {
			ok: true,
			section: 'announcements',
			success: 'Announcement published successfully.'
		};
	},

	// Edit an existing announcement.
	editAnnouncement: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const id = form.get('id')?.toString();

		const announcement = readAnnouncement(form);
		const message = validateAnnouncement(announcement);

		if (!id) {
			return fail(400, {
				message: 'No announcement selected.',
				section: 'announcements'
			});
		}

		if (message) {
			return fail(400, {
				message,
				section: 'announcements'
			});
		}

		const updated = await update((db) => {
			const existing = db.announcements.find(
				(a) => a.id === id
			);

			if (!existing) {
				return false;
			}

			// Preserve the original ID and publication date.
			Object.assign(existing, announcement, {
				updatedAt: new Date().toISOString()
			});

			sortAnnouncements(db.announcements);

			return true;
		});

		if (!updated) {
			return fail(404, {
				message: 'Announcement not found.',
				section: 'announcements'
			});
		}

		return {
			ok: true,
			section: 'announcements',
			success: 'Announcement updated successfully.'
		};
	},

	// Delete an existing announcement.
	deleteAnnouncement: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const id = form.get('id')?.toString();

		if (!id) {
			return fail(400, {
				message: 'No announcement selected.',
				section: 'announcements'
			});
		}

		const deleted = await update((db) => {
			const originalLength = db.announcements.length;

			db.announcements = db.announcements.filter(
				(a) => a.id !== id
			);

			return db.announcements.length < originalLength;
		});

		if (!deleted) {
			return fail(404, {
				message: 'Announcement not found.',
				section: 'announcements'
			});
		}

		return {
			ok: true,
			section: 'announcements',
			success: 'Announcement deleted successfully.'
		};
	}
};
