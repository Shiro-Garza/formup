
import { error, json } from '@sveltejs/kit';
import { getDb, update } from '#lib/server/db.js';

// Attendance check-in window.
const EARLY_MINUTES = 15;
const LATE_MINUTES = 120;

// Require an authenticated cadet.
function requireCadet(locals) {
	if (!locals.user) {
		error(401, 'Log in to mark attendance.');
	}

	if (locals.user.role === 'admin') {
		error(403, 'Administrators cannot submit cadet attendance.');
	}

	return locals.user;
}

// Retrieve the current cadet's attendance records.
export async function GET({ locals }) {
	const user = requireCadet(locals);
	const db = await getDb();

	const attendance = db.attendance
		.filter((a) => a.email === user.email)
		.map((a) => ({
			sessionId: a.sessionId,
			checkedInAt: a.checkedInAt
		}));

	return json(
		{ attendance },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

// Submit attendance for a PT session.
export async function POST({ request, locals }) {
	const user = requireCadet(locals);

	const body = await request.json().catch(() => null);
	const sessionId = body?.sessionId;

	if (typeof sessionId !== 'string' || !sessionId.trim()) {
		error(400, 'Select a valid PT session.');
	}

	const result = await update((db) => {
		const session = db.sessions.find(
			(s) => s.id === sessionId
		);

		if (!session) {
			error(404, 'PT session not found.');
		}

		// Prevent duplicate attendance records.
		const existing = db.attendance.find(
			(a) =>
				a.sessionId === sessionId &&
				a.email === user.email
		);

		if (existing) {
			return {
				ok: true,
				alreadyAttended: true,
				message: 'Attendance already recorded.'
			};
		}

		const now = Date.now();

		const start = new Date(
			`${session.date}T${session.time}:00`
		).getTime();

		if (Number.isNaN(start)) {
			error(400, 'Invalid PT session time.');
		}

		const opensAt =
			start - EARLY_MINUTES * 60 * 1000;

		const closesAt =
			start + LATE_MINUTES * 60 * 1000;

		if (now < opensAt) {
			error(
				400,
				'Attendance opens 15 minutes before PT.'
			);
		}

		if (now > closesAt) {
			error(
				400,
				'The attendance window has closed.'
			);
		}

		// Save attendance to the server database.
		db.attendance.push({
			id: crypto.randomUUID(),
			sessionId,
			email: user.email,
			checkedInAt: new Date().toISOString()
		});

		return {
			ok: true,
			alreadyAttended: false,
			message: 'Attendance recorded successfully.'
		};
	});

	return json(result);
}
