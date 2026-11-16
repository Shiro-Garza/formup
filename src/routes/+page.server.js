import { fail, redirect } from '@sveltejs/kit';

// Placeholder user until a real user store exists
const USER = { email: 'user@example.com', password: 'password123', username: 'user' };

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7
};

export function load({ cookies }) {
  const loggedIn = Boolean(cookies.get('session_id'));
  return { username: loggedIn ? (cookies.get('username') ?? null) : null };
}

export const actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    if (!email || !password) {
      return fail(400, { email, message: 'Email and password are required.' });
    }

    const isValidUser = email === USER.email && password === USER.password;

    if (!isValidUser) {
      return fail(401, { email, message: 'Invalid email or password.' });
    }

    cookies.set('session_id', 'your-generated-session-token', cookieOptions);
    cookies.set('username', USER.username, cookieOptions);

    redirect(303, '/');
  }
};
