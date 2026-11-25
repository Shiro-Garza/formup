import fs from 'node:fs/promises';
import path from 'node:path';
import { SCHEDULE } from '../events.js';

// Tiny JSON-file database: { sessions: [...], attempts: [...] }.
// Fine for a class project. A host with an ephemeral disk will lose this file on redeploy.
const FILE = path.resolve('data/db.json');

const iso = (d) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// First run: schedule the next two weeks from the weekly template so Home is not empty.
function seed() {
	const sessions = [];
	const today = new Date();
	for (let i = 0; i < 14; i++) {
		const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
		for (const s of SCHEDULE) {
			if (s.day === day.getDay()) {
				sessions.push({
					id: crypto.randomUUID(),
					date: iso(day),
					time: s.time,
					title: s.title,
					detail: s.detail
				});
			}
		}
	}
	return { sessions, attempts: [] };
}

async function write(db) {
	await fs.mkdir(path.dirname(FILE), { recursive: true });
	await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

async function read() {
	try {
		return JSON.parse(await fs.readFile(FILE, 'utf-8'));
	} catch {
		const db = seed();
		await write(db);
		return db;
	}
}

export const sortSessions = (list) =>
	list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

export const getDb = read;

// Serialize writes so two requests cannot overwrite each other.
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
