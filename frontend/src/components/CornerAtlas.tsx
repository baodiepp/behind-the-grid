import { useEffect, useMemo, useState } from "react";
import { getCornerAtlas } from "../lib/api";
import type { CornerSummary } from "../types";

type Range = { start: number; end: number };

type Props = {
  sessionId?: number;
  driver: string;
  referenceLap: number | null;
  compareLap: number | null;
  highlightRange: Range | null;
  onSelectRange: (range: Range | null) => void;
};

type CornerAtlasPayload = {
  corners: CornerSummary[];
  top_losses: Array<{ corner: number; delta_s: number | null }>
};

function formatSpeed(value: number): string {
  return `${Math.round(value)} kph`;
}

function formatPercent(value: number): string {
  if (value <= 1.5) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function formatDistance(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  const abs = Math.abs(value);
  return `${sign}${abs.toFixed(3)}s`;
}

export default function CornerAtlas({
  sessionId,
  driver,
  referenceLap,
  compareLap,
  highlightRange,
  onSelectRange,
}: Props) {
  const [data, setData] = useState<CornerAtlasPayload>({ corners: [], top_losses: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [minMagnitude, setMinMagnitude] = useState(0.02);

  useEffect(() => {
    if (!sessionId || referenceLap == null || compareLap == null) {
      setData({ corners: [], top_losses: [] });
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getCornerAtlas({ session_id: sessionId, driver_code: driver, reference_lap: referenceLap, compare_lap: compareLap })
      .then(res => {
        if (!active) return;
        setData(res);
      })
      .catch(err => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load corner data.");
        setData({ corners: [], top_losses: [] });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [sessionId, driver, referenceLap, compareLap]);

  useEffect(() => {
    setShowAll(false);
  }, [referenceLap, compareLap]);

  const topLossBadge = useMemo(() => {
    if (!data.top_losses.length) return null;
    const parts = data.top_losses
      .map(item => `C${item.corner} (${formatDelta(item.delta_s)})`)
      .join(", ");
    return `Top losses: ${parts}`;
  }, [data.top_losses]);

  const { rows, filteredCount, totalCount } = useMemo(() => {
    const sorted = data.corners
      .slice()
      .sort((a, b) => Math.abs(b.delta_s ?? 0) - Math.abs(a.delta_s ?? 0));
    const filtered = sorted.filter(c => Math.abs(c.delta_s ?? 0) >= minMagnitude);
    const rows = showAll ? filtered : filtered.slice(0, 8);
    return {
      rows,
      filteredCount: filtered.length,
      totalCount: data.corners.length,
    };
  }, [data.corners, showAll, minMagnitude]);

  if (!sessionId || referenceLap == null || compareLap == null) {
    return <div className="text-sm text-slate-400">Select a reference and comparison lap to see corner data.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">Corner Atlas</h2>
        {topLossBadge && (
          <div className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
            {topLossBadge}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>Showing {rows.length} of {totalCount} corners</span>
          <div className="flex items-center gap-2">
            <span>|Δt| ≥ {minMagnitude.toFixed(2)}s</span>
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.01}
              value={minMagnitude}
              disabled={showAll}
              onChange={e => setMinMagnitude(Number(e.target.value))}
              className="h-1 w-28 accent-amber-400 disabled:opacity-30"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className={`rounded-full border px-3 py-1 transition ${
              showAll
                ? "border-slate-500 text-slate-200"
                : "border-indigo-500 bg-indigo-600/20 text-indigo-100"
            }`}
          >
            {showAll ? "Top losses" : "Show all"}
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-400">Loading corner metrics…</div>}
      {error && <div className="text-sm text-rose-400">{error}</div>}

      {!loading && !data.corners.length && !error && (
        <div className="text-sm text-slate-400">No corners detected for this lap pairing.</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-auto rounded-xl border border-slate-800/60 bg-slate-950/50">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="sticky top-0 bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Corner</th>
                <th className="px-3 py-2 text-left">Distance</th>
                <th className="px-3 py-2 text-right">Entry</th>
                <th className="px-3 py-2 text-right">Apex</th>
                <th className="px-3 py-2 text-right">Exit</th>
                <th className="px-3 py-2 text-right">Peak Brake</th>
                <th className="px-3 py-2 text-right">Throttle Exit</th>
                <th className="px-3 py-2 text-right">Δ Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(corner => {
                const selected = highlightRange
                  ? Math.abs(highlightRange.start - corner.distance_start) < 1e-3 &&
                    Math.abs(highlightRange.end - corner.distance_end) < 1e-3
                  : false;
                const delta = corner.delta_s ?? 0;
                const deltaClass = delta > 0 ? "text-rose-400" : "text-emerald-400";
                return (
                  <tr
                    key={corner.corner}
                    onClick={() => {
                      if (selected) {
                        onSelectRange(null);
                      } else {
                        onSelectRange({ start: corner.distance_start, end: corner.distance_end });
                      }
                    }}
                    className={`cursor-pointer transition-colors ${selected ? "bg-indigo-900/40" : "hover:bg-slate-900/60"}`}
                  >
                    <td className="px-3 py-2 font-medium">C{corner.corner}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {formatDistance(corner.distance_start)} — {formatDistance(corner.distance_end)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatSpeed(corner.entry_speed)}</td>
                    <td className="px-3 py-2 text-right">{formatSpeed(corner.apex_speed)}</td>
                    <td className="px-3 py-2 text-right">{formatSpeed(corner.exit_speed)}</td>
                    <td className="px-3 py-2 text-right">{formatPercent(corner.brake_peak)}</td>
                    <td className="px-3 py-2 text-right">{formatPercent(corner.throttle_exit)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${deltaClass}`}>
                      {formatDelta(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && filteredCount === 0 && data.corners.length > 0 && (
        <div className="text-sm text-slate-400">
          No corners meet the current Δt filter. Lower the threshold or toggle “Show all”.
        </div>
      )}

      {highlightRange && (
        <button
          type="button"
          onClick={() => onSelectRange(null)}
          className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:border-slate-400"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
