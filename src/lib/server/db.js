import fs from 'node:fs/promises';
import path from 'node:path';
import { SCHEDULE, ANNOUNCEMENTS } from '../events.js';

// JSON-file database for PT sessions, PFA attempts, workouts,
// attendance records, and announcements.
const FILE = path.resolve('data/db.json');

const iso = (d) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Convert existing hardcoded announcements into database records.
function seedAnnouncements() {
	return ANNOUNCEMENTS.flatMap((group) =>
		group.items.map((item, index) => ({
			id: `original-${group.date}-${index}`,
			title: 'General Announcement',
			message: item,
			priority: 'normal',
			date: group.date,
			createdAt: `${group.date}T00:00:00.000Z`,
			updatedAt: null
		}))
	);
}

// Generate the initial database.
function seed() {
	const sessions = [];
	const today = new Date();

	for (let i = 0; i < 14; i++) {
		const day = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate() + i
		);

		for (const s of SCHEDULE) {
			if (s.day === day.getDay()) {
				sessions.push({
					id: crypto.randomUUID(),
					date: iso(day),
					time: s.time,
					title: s.title,
					detail: s.detail,
					location: s.location ?? ''
				});
			}
		}
	}

	return {
		sessions,
		attempts: [],
		workouts: [],
		attendance: [],
		announcements: seedAnnouncements()
	};
}

// Support older database files without losing existing data.
function normalize(db) {
	if (!Array.isArray(db.sessions)) {
		db.sessions = [];
	}

	if (!Array.isArray(db.attempts)) {
		db.attempts = [];
	}

	if (!Array.isArray(db.workouts)) {
		db.workouts = [];
	}

	if (!Array.isArray(db.attendance)) {
		db.attendance = [];
	}

	// Import original announcements only when the
	// announcements collection does not exist.
	if (!Array.isArray(db.announcements)) {
		db.announcements = seedAnnouncements();
	}

	return db;
}

// Save the database.
async function write(db) {
	await fs.mkdir(path.dirname(FILE), {
		recursive: true
	});

	await fs.writeFile(
		FILE,
		JSON.stringify(db, null, 2)
	);
}

// Read the database.
async function read() {
	try {
		const db = JSON.parse(
			await fs.readFile(FILE, 'utf-8')
		);

		return normalize(db);
	} catch (err) {
		// Only create a new database if the file does not exist.
		// Do not overwrite existing data on other errors.
		if (err.code !== 'ENOENT') {
			throw err;
		}

		const db = seed();

		await write(db);

		return db;
	}
}

// Sort PT sessions chronologically.
export const sortSessions = (list) =>
	list.sort((a, b) =>
		`${a.date} ${a.time}`.localeCompare(
			`${b.date} ${b.time}`
		)
	);

// Sort announcements from newest to oldest.
export const sortAnnouncements = (list) =>
	list.sort((a, b) =>
		b.createdAt.localeCompare(a.createdAt)
	);

export const getDb = read;

// Serialize database updates to prevent overlapping writes.
let queue = Promise.resolve();

export function update(fn) {
	const run = queue.then(async () => {
		const db = await read();

		const result = await fn(db);

		await write(db);

		return result;
	});

	queue = run.catch(() => {});

	return run;
}
