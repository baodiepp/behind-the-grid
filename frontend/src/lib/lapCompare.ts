import type { TelemetryRow } from "../types";

export type ResampledSeries = {
  dist: number[];
  time: number[];
  speed: number[];
};

export type ComparisonResult = {
  speedSeries: Array<{ distance: number; reference: number; compare: number }>;
  deltaSeries: Array<{ distance: number; delta: number }>;
  summary: {
    totalDelta: number;
    bestGain: { delta: number; distance: number } | null;
    worstLoss: { delta: number; distance: number } | null;
    lapLength: number;
  };
};

type LapSeries = {
  dist: number[];
  time: number[];
  speed: number[];
  lapLength: number;
};

const MIN_POINTS = 2;

export function buildLapSeries(rows: TelemetryRow[]): LapSeries | null {
  const samples = rows.filter(r => r.x != null && r.y != null);
  if (samples.length < MIN_POINTS) return null;

  const dist: number[] = [0];
  const time: number[] = [0];
  const speed: number[] = [samples[0].speed ?? 0];
  const x0 = samples[0].x as number;
  const y0 = samples[0].y as number;
  const t0 = samples[0].ts;

  let prevX = x0;
  let prevY = y0;

  for (let i = 1; i < samples.length; i += 1) {
    const { x, y, ts, speed: spd } = samples[i];
    if (x == null || y == null) continue;

    const dx = x - prevX;
    const dy = y - prevY;
    const segment = Math.hypot(dx, dy);

    const cumulative = dist[dist.length - 1] + segment;
    dist.push(cumulative);
    time.push(ts - t0);
    speed.push(spd ?? speed[speed.length - 1] ?? 0);

    prevX = x;
    prevY = y;
  }

  if (dist.length < MIN_POINTS) return null;

  return {
    dist,
    time,
    speed,
    lapLength: dist[dist.length - 1],
  };
}

export function resampleSeries(series: LapSeries, step = 5): ResampledSeries {
  const { dist, time, speed, lapLength } = series;
  const normalizedStep = step <= 0 ? 5 : step;
  const steps = Math.max(1, Math.floor(lapLength / normalizedStep));
  const grid: number[] = [];
  const outTime: number[] = [];
  const outSpeed: number[] = [];

  let cursor = 1;
  for (let i = 0; i <= steps; i += 1) {
    const target = Math.min(lapLength, i * normalizedStep);
    while (cursor < dist.length && dist[cursor] < target) {
      cursor += 1;
    }
    if (cursor >= dist.length) {
      grid.push(target);
      outTime.push(time[time.length - 1]);
      outSpeed.push(speed[speed.length - 1] ?? 0);
      continue;
    }
    const x1 = dist[cursor];
    const x0 = dist[cursor - 1];
    const ratio = x1 === x0 ? 0 : (target - x0) / (x1 - x0);
    const t0 = time[cursor - 1];
    const t1 = time[cursor];
    const s0 = speed[cursor - 1] ?? 0;
    const s1 = speed[cursor] ?? s0;

    grid.push(target);
    outTime.push(t0 + ratio * (t1 - t0));
    outSpeed.push(s0 + ratio * (s1 - s0));
  }

  if (grid[grid.length - 1] !== lapLength) {
    grid.push(lapLength);
    outTime.push(time[time.length - 1]);
    outSpeed.push(speed[speed.length - 1] ?? 0);
  }

  return { dist: grid, time: outTime, speed: outSpeed };
}

export function compareLaps(reference: ResampledSeries, compare: ResampledSeries): ComparisonResult | null {
  const length = Math.min(reference.dist.length, compare.dist.length);
  if (length < MIN_POINTS) return null;

  const speedSeries: Array<{ distance: number; reference: number; compare: number }> = [];
  const deltaSeries: Array<{ distance: number; delta: number }> = [];

  let bestGain: { delta: number; distance: number } | null = null;
  let worstLoss: { delta: number; distance: number } | null = null;

  for (let i = 0; i < length; i += 1) {
    const distance = reference.dist[i];
    const refSpeed = reference.speed[i];
    const cmpSpeed = compare.speed[i];
    const delta = compare.time[i] - reference.time[i];

    speedSeries.push({ distance, reference: refSpeed, compare: cmpSpeed });
    deltaSeries.push({ distance, delta });

    if (bestGain === null || delta < bestGain.delta) {
      bestGain = { delta, distance };
    }
    if (worstLoss === null || delta > worstLoss.delta) {
      worstLoss = { delta, distance };
    }
  }

  const totalDelta = deltaSeries[deltaSeries.length - 1]?.delta ?? 0;

  return {
    speedSeries,
    deltaSeries,
    summary: {
      totalDelta,
      bestGain,
      worstLoss,
      lapLength: reference.dist[length - 1],
    },
  };
}
