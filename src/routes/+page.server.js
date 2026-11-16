import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import { fail, redirect } from '@sveltejs/kit';

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7
};

async function getUsersFromCsv() {
  const csvPath = path.resolve('src/lib/assets/login.csv');
  const csvText = await fs.readFile(csvPath, 'utf-8');
  
  const { data } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
    transform: (value) => value.trim()
  });

  // Check your terminal console to see the exact parsed rows
  console.log('Parsed CSV users:', data);
  
  return data;
}

function getDisplayName(csvUsername, email) {
  const trimmedUsername = csvUsername?.trim();
  if (trimmedUsername) {
    return trimmedUsername;
  }

  const localPart = email.split('@')[0];
  const firstName = localPart.split(/[._-]/)[0];

  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

export function load({ cookies }) {
  const loggedIn = Boolean(cookies.get('session_id'));
  return { username: loggedIn ? (cookies.get('username') ?? null) : null };
}

export const actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim().toLowerCase();
    const password = data.get('password')?.toString().trim();

    if (!email || !password) {
      return fail(400, { email, message: 'Email and password are required.' });
    }

    const users = await getUsersFromCsv();
    const matchedUser = users.find(
      (u) => u.email?.toLowerCase() === email && u.password === password
    );

    if (!matchedUser) {
      return fail(401, { email, message: 'Invalid email or password.' });
    }

    const displayName = getDisplayName(matchedUser.username, email);

    cookies.set('session_id', crypto.randomUUID(), cookieOptions);
    cookies.set('username', displayName, cookieOptions);

    redirect(303, '/');
  }
};
