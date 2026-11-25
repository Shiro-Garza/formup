import { getDb } from '#lib/server/db.js';

export async function load({ locals }) {
	const db = await getDb();
	return { user: locals.user, sessions: db.sessions };
}
