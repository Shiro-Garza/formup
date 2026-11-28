// Assessment events, activity types, scoring, and formatting helpers.
//
// NOTE: scoring here is a simple placeholder (percent of the "best" standard,
// averaged into a composite). Swap `best` values or `eventScore` for the real
// fitness assessment tables when you have them.

export const EVENTS = [
	{
		id: 'run',
		label: '2-mile run',
		kind: 'time',
		better: 'lower',
		best: 690, // seconds (11:30) = 100 points
		focus: 'Add one interval session a week, such as 4 x 400 m at goal pace.'
	},
	{
		id: 'pushups',
		label: 'Hand-release push-ups',
		kind: 'reps',
		better: 'higher',
		best: 45, // reps = 100 points
		focus: 'Do 3 sets close to failure twice a week.'
	},
	{
		id: 'situps',
		label: 'Sit-ups',
		kind: 'reps',
		better: 'higher',
		best: 60, // reps = 100 points
		focus: 'Do 3 sets of timed sit-up intervals twice a week.'
	}
];

export const ACTIVITIES = [
	{ id: 'run', label: 'Run', fields: ['distance', 'time'] },
	{ id: 'pushups', label: 'Push-ups', fields: ['reps'] },
	{ id: 'situps', label: 'Sit-ups', fields: ['reps'] },
	{ id: 'plank', label: 'Plank', fields: ['time'] }
];

export const SCHEDULE = [
	{ day: 2, time: '06:00', title: 'Run Day', detail: '1 minute sprints, 1:30 walk' },
	{ day: 4, time: '06:00', title: 'Strength', detail: 'Push-ups, sit-ups, plank circuit' }
];

export const ANNOUNCEMENTS = [
	{ date: '2026-11-02', items: ['UOD: PTs / cold weather', 'PT formation @ 0545', 'Bring reflective belt'] },
	{ date: '2026-10-28', items: ['PT starts: Yellow', 'Phase check next week', 'Nutrition plan due Fri'] }
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
export const activityById = (id) => ACTIVITIES.find((a) => a.id === id);

export function formatTime(totalSeconds) {
	const m = Math.floor(totalSeconds / 60);
	const s = Math.round(totalSeconds % 60);
	return `${m}:${String(s).padStart(2, '0')}`;
}

// Accepts "m:ss" or a plain number of seconds. Returns null if invalid.
export function parseTime(text) {
	const t = String(text ?? '').trim();
	const match = t.match(/^(\d+):([0-5]\d)$/);
	if (match) return Number(match[1]) * 60 + Number(match[2]);
	if (/^\d+$/.test(t) && Number(t) > 0) return Number(t);
	return null;
}

export function formatValue(event, value) {
	const numeric = Number(value);

	// Legacy or partial records may not include every event.
	if (!Number.isFinite(numeric) || numeric <= 0) return '—';

	return event.kind === 'time'
		? formatTime(numeric)
		: String(numeric);
}

export function eventScore(event, value) {
	const raw = event.better === 'lower' ? event.best / value : value / event.best;
	return Math.max(0, Math.min(100, raw * 100));
}

export function compositeScore(results) {
	// Score only the events a record actually contains.
	const scores = EVENTS.filter(
		(e) => Number(results?.[e.id]) > 0
	).map((e) => eventScore(e, Number(results[e.id])));

	return scores.length
		? scores.reduce((a, b) => a + b, 0) / scores.length
		: 0;
}

// Shared PT attendance check-in window.
export const ATTENDANCE_EARLY_MINUTES = 15;
export const ATTENDANCE_LATE_MINUTES = 120;

// Resolve a session's start time and its check-in window.
export function attendanceWindow(session) {
	const start = new Date(`${session.date}T${session.time}:00`).getTime();

	if (Number.isNaN(start)) return null;

	return {
		start,
		opensAt: start - ATTENDANCE_EARLY_MINUTES * 60 * 1000,
		closesAt: start + ATTENDANCE_LATE_MINUTES * 60 * 1000
	};
}

export function todayISO(d = new Date()) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function formatDate(iso) {
	return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function workoutLabel(w) {
	if (w.activity === 'run') return `${w.distance} mile run`;
	return activityById(w.activity)?.label ?? w.activity;
}

export function workoutValue(w) {
	if (w.activity === 'run') return formatTime(w.seconds);
	if (w.activity === 'plank') return formatTime(w.seconds);
	return `${w.reps} reps`;
}

// Next scheduled PT session at or after `now` (a session stays "current" for 2 hours).
// `sessions` are admin-scheduled: { id, date: 'YYYY-MM-DD', time: 'HH:MM', title, detail }.
export function nextSession(sessions, now = new Date()) {
	let best = null;
	for (const s of sessions) {
		const start = new Date(`${s.date}T${s.time}:00`);
		if (Number.isNaN(start.getTime())) continue;
		if (start.getTime() < now.getTime() - 2 * 3600 * 1000) continue;
		if (!best || start < best.start) best = { ...s, start, key: s.id };
	}
	return best;
}

export function sessionTimeLabel(start) {
	const wd = start.toLocaleDateString('en-US', { weekday: 'short' });
	const hhmm = start.toTimeString().slice(0, 5).replace(':', '');
	return `${wd} · ${hhmm}`;
}

export function untilLabel(start, now = new Date()) {
	const mins = Math.round((start.getTime() - now.getTime()) / 60000);
	if (mins <= 0) return 'Now';
	if (mins < 60) return `In ${mins} min`;
	if (mins < 24 * 60) return `In ${Math.round(mins / 60)} hrs`;
	return `In ${Math.round(mins / 1440)} days`;
}

// Seed data from the proposal mockups so the app is not empty on first run.
export const SEED_WORKOUTS = [
	{ id: 's1', date: '2026-10-28', activity: 'run', distance: 2, seconds: 1112, effort: 4, note: '' },
	{ id: 's2', date: '2026-10-26', activity: 'pushups', reps: 42, effort: 4, note: '' },
	{ id: 's3', date: '2026-10-24', activity: 'situps', reps: 55, effort: 3, note: '' },
	{ id: 's4', date: '2026-10-22', activity: 'plank', seconds: 195, effort: 4, note: '' }
];

export const SEED_ATTEMPTS = [
	{ id: 'a1', date: '2026-08-20', results: { run: 780, pushups: 31, situps: 44 } },
	{ id: 'a2', date: '2026-09-22', results: { run: 745, pushups: 36, situps: 50 } },
	{ id: 'a3', date: '2026-10-26', results: { run: 730, pushups: 39, situps: 55 } }
];
