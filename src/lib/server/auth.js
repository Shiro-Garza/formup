import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

export const cookieOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'strict',
	secure: process.env.NODE_ENV === 'production',
	maxAge: 60 * 60 * 24 * 7
};

// Sessions live on the server. The cookie only holds a random id, so a user
// cannot change their own role by editing cookies. Sessions reset on restart.
const sessions = (globalThis.__formupSessions ??= new Map());

export function displayName(csvUsername, email) {
	const trimmed = csvUsername?.trim();
	if (trimmed) return trimmed;
	const first = email.split('@')[0].split(/[._-]/)[0];
	return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Reads login.csv: columns email, password, username, role ("admin" or blank for cadet).
export async function getUsers() {
	const csvText = await fs.readFile(path.resolve('src/lib/assets/login.csv'), 'utf-8');
	const { data } = Papa.parse(csvText, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (h) => h.trim().toLowerCase(),
		transform: (v) => v.trim()
	});
	return data
		.filter((u) => u.email)
		.map((u) => ({
			email: u.email.toLowerCase(),
			password: u.password,
			name: displayName(u.username, u.email),
			role: u.role?.toLowerCase() === 'admin' ? 'admin' : 'cadet'
		}));
}

export function createSession(user) {
	const id = crypto.randomUUID();
	sessions.set(id, { email: user.email, name: user.name, role: user.role });
	return id;
}

export const getSession = (id) => sessions.get(id) ?? null;
export const destroySession = (id) => sessions.delete(id);
