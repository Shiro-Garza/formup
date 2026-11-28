<script>
	// Simple SVG trend chart with a dashed goal line.
	// "better" decides direction: for 'lower' (e.g. run time) the axis is flipped so up always means improving.
	let { points, goal = null, better = 'higher', format = (v) => String(v), label = 'Trend chart' } = $props();

	const hasGoal = $derived(
		typeof goal === 'number' && Number.isFinite(goal)
	);

	const W = 320;
	const H = 190;
	const PL = 32;
	const PR = 32;
	const PT = 22;
	const PB = 28;

	const range = $derived.by(() => {
		const vals = [
			...points.map((p) => p.value),
			...(hasGoal ? [goal] : [])
		];
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const pad = (max - min || 1) * 0.2;
		return { lo: min - pad, hi: max + pad };
	});

	function y(v) {
		const t = (v - range.lo) / (range.hi - range.lo);
		const inner = H - PT - PB;
		return better === 'higher' ? PT + (1 - t) * inner : PT + t * inner;
	}

	function x(i) {
		if (points.length === 1) return W / 2;
		return PL + (i * (W - PL - PR)) / (points.length - 1);
	}

	const path = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' '));
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label={label}>
	{#if hasGoal}
		<line class="goal" x1={PL} x2={W - PR} y1={y(goal)} y2={y(goal)} />
		<text class="goal-label" x={W - PR} y={y(goal) - 6} text-anchor="end">Goal {format(goal)}</text>
	{/if}

	{#if points.length > 1}
		<path class="line" d={path} />
	{/if}

	{#each points as p, i}
		<circle class="dot" cx={x(i)} cy={y(p.value)} r="5" />
		<text class="val" x={x(i)} y={y(p.value) - 10} text-anchor="middle">{format(p.value)}</text>
		<text class="axis" x={x(i)} y={H - 8} text-anchor="middle">{p.label}</text>
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.goal {
		stroke: var(--color-text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 5 5;
	}

	.line {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.dot {
		fill: var(--color-accent);
		stroke: var(--color-card);
		stroke-width: 2;
	}

	text {
		font-family: var(--font-body);
		font-size: 11px;
	}

	.goal-label,
	.axis {
		fill: var(--color-text-muted);
	}

	.val {
		fill: var(--color-text);
		font-weight: 600;
	}
</style>
