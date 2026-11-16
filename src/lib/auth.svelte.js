// Client-side auth for the MVP. Accounts live in localStorage (no backend).
// Swap the bodies of signUp/logIn/logOut for API calls later; the UI won't change.

const USERS_KEY = 'formup.users';
const SESSION_KEY = 'formup.session';

export const auth = $state({ user: null, ready: false });

function read(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}

function write(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage unavailable (private mode); session just won't persist
	}
}

async function hash(text) {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeEmail(email) {
	return String(email ?? '').trim().toLowerCase();
}

function publicUser(record) {
	const { salt, passwordHash, ...rest } = record;
	return rest;
}

export function initAuth() {
	const email = read(SESSION_KEY, null);
	const users = read(USERS_KEY, {});
	auth.user = email && users[email] ? publicUser(users[email]) : null;
	auth.ready = true;
}

export async function signUp({ name, email, password, role }) {
	const key = normalizeEmail(email);
	if (!name?.trim()) return { ok: false, error: 'Enter your name.' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return { ok: false, error: 'Enter a valid email.' };
	if (String(password ?? '').length < 8)
		return { ok: false, error: 'Password must be at least 8 characters.' };
	if (role !== 'cadet' && role !== 'leader') return { ok: false, error: 'Choose a role.' };

	const users = read(USERS_KEY, {});
	if (users[key]) return { ok: false, error: 'An account with that email already exists.' };

	const salt = crypto.randomUUID();
	users[key] = {
		name: name.trim(),
		email: key,
		role,
		flight: '',
		classYear: '',
		targetScore: null,
		salt,
		passwordHash: await hash(salt + password)
	};
	write(USERS_KEY, users);
	write(SESSION_KEY, key);
	auth.user = publicUser(users[key]);
	return { ok: true };
}

export async function logIn({ email, password }) {
	const key = normalizeEmail(email);
	if (!key || !password) return { ok: false, error: 'Enter your email and password.' };

	const users = read(USERS_KEY, {});
	const record = users[key];
	// Same message for unknown email and wrong password.
	if (!record || (await hash(record.salt + password)) !== record.passwordHash)
		return { ok: false, error: 'Incorrect email or password.' };

	write(SESSION_KEY, key);
	auth.user = publicUser(record);
	return { ok: true };
}

export function logOut() {
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch {
		// ignore
	}
	auth.user = null;
}
