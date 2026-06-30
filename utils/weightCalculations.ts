import { WeightLog, WeeklyAverage, MovingAveragePoint, WeightTrend, WeekComparison } from '../types';

/**
 * Parse a YYYY-MM-DD string as a UTC Date so that .getUTCDay() etc.
 * return the same values as the Singapore date (since YYYY-MM-DD midnight
 * in Singapore = the same calendar date as midnight UTC).
 */
function parseUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Get the Monday of the ISO week containing this date. */
function getWeekStart(dateStr: string): string {
  const date = parseUTC(dateStr);
  const day = date.getUTCDay();       // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/** Human-readable week label e.g. "Jun 29 – Jul 5". */
function getWeekLabel(weekStart: string): string {
  const start = parseUTC(weekStart);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** ISO week identifier like "2026-W27". */
function getWeekId(dateStr: string): string {
  const date = parseUTC(dateStr);
  const day = (date.getUTCDay() + 6) % 7; // Mon=0
  const nearest = new Date(date);
  nearest.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = nearest.getTime();
  nearest.setUTCMonth(0, 1);
  if (nearest.getUTCDay() !== 4) {
    nearest.setUTCMonth(0, 1 + ((4 - nearest.getUTCDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - nearest.getTime()) / 604_800_000);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ---- Exported API ----

/** Group weight logs by ISO week and return averages. */
export function getWeeklyAverages(logs: WeightLog[]): WeeklyAverage[] {
  if (logs.length === 0) return [];

  const groups = new Map<string, { total: number; min: number; max: number; count: number }>();

  for (const log of logs) {
    const weekStart = getWeekStart(log.date);
    const g = groups.get(weekStart);
    if (g) {
      g.total += log.weight;
      g.min = Math.min(g.min, log.weight);
      g.max = Math.max(g.max, log.weight);
      g.count += 1;
    } else {
      groups.set(weekStart, { total: log.weight, min: log.weight, max: log.weight, count: 1 });
    }
  }

  return Array.from(groups.entries())
    .map(([ws, d]) => ({
      weekId: getWeekId(ws),
      label: getWeekLabel(ws),
      avg: Number((d.total / d.count).toFixed(1)),
      min: Number(d.min.toFixed(1)),
      max: Number(d.max.toFixed(1)),
      count: d.count,
    }))
    .sort((a, b) => a.weekId.localeCompare(b.weekId));
}

/**
 * Simple moving average — for each data point, average all weigh-ins
 * in the preceding `window` calendar days (default 7).
 * Returns `movingAvg: null` until at least half the window has data.
 */
export function getMovingAverage(logs: WeightLog[], window = 7): MovingAveragePoint[] {
  if (logs.length === 0) return [];

  // Deduplicate by date (last write wins, matching app behavior)
  const map = new Map<string, number>();
  for (const l of logs) map.set(l.date, l.weight);

  const sorted = Array.from(map.keys()).sort();

  return sorted.map((date, i) => {
    const weight = map.get(date)!;
    const cutoff = parseUTC(date);
    cutoff.setUTCDate(cutoff.getUTCDate() - (window - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    let total = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (sorted[j] < cutoffStr) break;
      total += map.get(sorted[j])!;
      count++;
    }

    return {
      date,
      weight,
      movingAvg: count >= Math.ceil(window / 2)
        ? Number((total / count).toFixed(1))
        : null,
    };
  });
}

/** Estimate the current trend by comparing the last two complete weekly averages. */
export function getWeightTrend(logs: WeightLog[]): WeightTrend {
  const avgs = getWeeklyAverages(logs);
  if (avgs.length < 2) return { weeklyRate: null, direction: null };

  const diff = avgs[avgs.length - 1].avg - avgs[avgs.length - 2].avg;
  const threshold = 0.1;

  if (diff > threshold) return { weeklyRate: Number(diff.toFixed(1)), direction: 'up' };
  if (diff < -threshold) return { weeklyRate: Number(diff.toFixed(1)), direction: 'down' };
  return { weeklyRate: Number(diff.toFixed(1)), direction: 'stable' };
}

/** Compare the most recent complete week against the one before it. */
export function getWeekComparison(logs: WeightLog[]): WeekComparison | null {
  const avgs = getWeeklyAverages(logs);
  if (avgs.length < 2) return null;

  const cur = avgs[avgs.length - 1];
  const prev = avgs[avgs.length - 2];

  return {
    currentAvg: cur.avg,
    lastAvg: prev.avg,
    delta: Number((cur.avg - prev.avg).toFixed(1)),
    currentLabel: cur.label,
    lastLabel: prev.label,
  };
}
