import { error, json } from '@sveltejs/kit';
import { getDb, update } from '#lib/server/db.js';
import { ACTIVITIES } from '#lib/events.js';

// Return workout information without exposing account data.
function publicWorkout(workout) {
	return {
		id: workout.id,
		date: workout.date,
		activity: workout.activity,
		distance: workout.distance,
		seconds: workout.seconds,
		reps: workout.reps,
		effort: workout.effort,
		note: workout.note ?? '',
		createdAt: workout.createdAt
	};
}

// Require an authenticated cadet.
function requireCadet(locals) {
	if (!locals.user) {
		error(401, 'Log in to sync workouts.');
	}

	if (locals.user.role === 'admin') {
		error(403, 'Administrators cannot submit cadet workouts.');
	}

	return locals.user;
}

// Validate a workout payload. Throws a 400 error when it is invalid.
function readWorkout(body) {
	const date = body?.date;

	if (
		typeof date !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}$/.test(date)
	) {
		error(400, 'Invalid workout date.');
	}

	const parsedDate = new Date(`${date}T00:00:00Z`);

	if (
		Number.isNaN(parsedDate.getTime()) ||
		parsedDate.toISOString().slice(0, 10) !== date
	) {
		error(400, 'Enter a valid workout date.');
	}

	if (date > new Date().toISOString().slice(0, 10)) {
		error(400, 'Workout dates cannot be in the future.');
	}

	const definition = ACTIVITIES.find(
		(a) => a.id === body?.activity
	);

	if (!definition) {
		error(400, 'Select a valid activity.');
	}

	const effort = Number(body?.effort);

	if (
		!Number.isInteger(effort) ||
		effort < 1 ||
		effort > 5
	) {
		error(400, 'Effort must be a whole number from 1 to 5.');
	}

	const note =
		typeof body?.note === 'string'
			? body.note.trim().slice(0, 500)
			: '';

	const workout = {
		date,
		activity: definition.id,
		effort,
		note
	};

	if (definition.fields.includes('distance')) {
		const distance = Number(body?.distance);

		if (
			!Number.isFinite(distance) ||
			distance <= 0 ||
			distance > 100
		) {
			error(400, 'Enter a distance greater than 0 and at most 100 miles.');
		}

		workout.distance = distance;
	}

	if (definition.fields.includes('time')) {
		const seconds = Number(body?.seconds);

		if (
			!Number.isFinite(seconds) ||
			seconds <= 0 ||
			seconds > 86400
		) {
			error(400, 'Enter a valid workout time.');
		}

		workout.seconds = seconds;
	}

	if (definition.fields.includes('reps')) {
		const reps = Number(body?.reps);

		if (
			!Number.isInteger(reps) ||
			reps <= 0 ||
			reps > 1000
		) {
			error(400, 'Enter a whole number of reps.');
		}

		workout.reps = reps;
	}

	return workout;
}

// Retrieve the logged-in cadet's workout history.
export async function GET({ locals }) {
	const user = requireCadet(locals);
	const email = user.email.trim().toLowerCase();

	const db = await getDb();

	const workouts = (db.workouts ?? [])
		.filter(
			(w) => w.email?.trim().toLowerCase() === email
		)
		.sort(
			(a, b) =>
				b.date.localeCompare(a.date) ||
				(b.createdAt ?? '').localeCompare(
					a.createdAt ?? ''
				)
		)
		.map(publicWorkout);

	return json(
		{ workouts },
		{
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}

// Save a new workout.
export async function POST({ request, locals }) {
	const user = requireCadet(locals);
	const email = user.email.trim().toLowerCase();

	const workout = readWorkout(
		await request.json().catch(() => null)
	);

	const saved = await update((db) => {
		db.workouts ??= [];

		const record = {
			id: crypto.randomUUID(),
			email,
			...workout,
			createdAt: new Date().toISOString()
		};

		db.workouts.push(record);

		return record;
	});

	return json(
		{
			ok: true,
			workout: publicWorkout(saved),
			message: 'Workout saved successfully.'
		},
		{
			status: 201,
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}

// Delete one of the logged-in cadet's workouts.
export async function DELETE({ url, locals }) {
	const user = requireCadet(locals);
	const email = user.email.trim().toLowerCase();
	const id = url.searchParams.get('id');

	if (!id) {
		error(400, 'Select a workout to delete.');
	}

	const deleted = await update((db) => {
		db.workouts ??= [];

		const originalLength = db.workouts.length;

		db.workouts = db.workouts.filter(
			(w) =>
				!(
					w.id === id &&
					w.email?.trim().toLowerCase() === email
				)
		);

		return db.workouts.length < originalLength;
	});

	if (!deleted) {
		error(404, 'Workout not found.');
	}

	return json(
		{ ok: true, message: 'Workout deleted successfully.' },
		{
			headers: {
				'Cache-Control': 'private, no-store'
			}
		}
	);
}
