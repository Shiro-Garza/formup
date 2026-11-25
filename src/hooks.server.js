import { getSession } from '#lib/server/auth.js';

export function handle({ event, resolve }) {
	const id = event.cookies.get('session_id');
	event.locals.user = id ? getSession(id) : null;
	return resolve(event);
}
