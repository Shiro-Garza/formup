import { fail, redirect } from '@sveltejs/kit';
import { getUsers, createSession, destroySession, cookieOptions } from '#lib/server/auth.js';

export function load({ locals }) {
	return { username: locals.user?.name ?? null };
}

export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim().toLowerCase();
		const password = data.get('password')?.toString().trim();

		if (!email || !password) {
			return fail(400, { email, message: 'Email and password are required.' });
		}

		const users = await getUsers();
		const user = users.find((u) => u.email === email && u.password === password);

		if (!user) {
			return fail(401, { email, message: 'Invalid email or password.' });
		}

		cookies.set('session_id', createSession(user), cookieOptions);

		redirect(303, user.role === 'admin' ? '/admin' : '/');
	},

	logout: async ({ cookies }) => {
		const id = cookies.get('session_id');
		if (id) destroySession(id);
		cookies.delete('session_id', { path: '/' });
		redirect(303, '/');
	}
};
