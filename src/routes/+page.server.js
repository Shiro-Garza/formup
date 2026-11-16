import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    if (!email || !password) {
      return fail(400, { email, message: 'Email and password are required.' });
    }

    const isValidUser = email === 'user@example.com' && password === 'password123';

    if (!isValidUser) {
      return fail(401, { email, message: 'Invalid email or password.' });
    }

    cookies.set('session_id', 'your-generated-session-token', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7
    });

    throw redirect(303, '/dashboard');
  }
};
