
import {
	getDb,
	sortAnnouncements
} from '#lib/server/db.js';

export async function load({ locals }) {
	const db = await getDb();

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
		user: locals.user,
		sessions: db.sessions,
		announcements
	};
}
