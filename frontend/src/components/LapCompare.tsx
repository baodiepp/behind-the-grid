import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Area, ComposedChart, ReferenceArea } from "recharts";
import { getTelemetry } from "../lib/api";
import type { LapRow } from "../lib/api";
import { buildLapSeries, resampleSeries, compareLaps, type ComparisonResult } from "../lib/lapCompare";
import { Label, Select } from "./ui";

type Props = {
  sessionId?: number;
  driver: string;
  referenceLap: number | null;
  compareLap: number | null;
  laps: LapRow[];
  onSetReference: (lap: number) => void;
  onSetCompare: (lap: number | null) => void;
  highlightRange?: { start: number; end: number } | null;
  onHighlightClear?: () => void;
};

function formatDelta(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "±";
  const abs = Math.abs(seconds);
  const ms = Math.round(abs * 1000);
  const whole = Math.floor(ms / 1000);
  const remainder = ms % 1000;
  return `${sign}${whole}.${String(remainder).padStart(3, "0")}s`;
}

function formatDistance(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export default function LapCompare({
  sessionId,
  driver,
  referenceLap,
  compareLap,
  laps,
  onSetReference,
  onSetCompare,
  highlightRange,
  onHighlightClear,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  const lapOptions = useMemo(() => laps.filter(l => !l.is_pit && l.lap_ms), [laps]);

  useEffect(() => {
    if (!lapOptions.length) return;
    if (!referenceLap || !lapOptions.some(l => l.lap === referenceLap)) {
      onSetReference(lapOptions[0].lap);
    }
    if (!compareLap || !lapOptions.some(l => l.lap === compareLap)) {
      const fallback = lapOptions.find(l => l.lap !== (referenceLap ?? lapOptions[0].lap)) ?? lapOptions[0];
      onSetCompare(fallback?.lap ?? null);
    }
  }, [lapOptions, referenceLap, compareLap, onSetReference, onSetCompare]);

  useEffect(() => {
    if (!sessionId || !referenceLap || !compareLap) {
      setComparison(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getTelemetry({ session_id: sessionId, driver_code: driver, lap_number: referenceLap, limit: 20000 }),
      getTelemetry({ session_id: sessionId, driver_code: driver, lap_number: compareLap, limit: 20000 }),
    ])
      .then(([refRows, cmpRows]) => {
        if (!active) return;
        const refSeries = buildLapSeries(refRows);
        const cmpSeries = buildLapSeries(cmpRows);
        if (!refSeries || !cmpSeries) {
          setComparison(null);
          setError("Not enough telemetry points with XY data to compare these laps.");
          return;
        }
        const refResampled = resampleSeries(refSeries, 5);
        const cmpResampled = resampleSeries(cmpSeries, 5);
        const result = compareLaps(refResampled, cmpResampled);
        if (!result) {
          setComparison(null);
          setError("Unable to compute a lap delta for this selection.");
          return;
        }
        setComparison(result);
      })
      .catch(err => {
        if (!active) return;
        setComparison(null);
        setError(err instanceof Error ? err.message : "Failed to load lap telemetry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [sessionId, driver, referenceLap, compareLap]);

  const compareWidth = useMemo(() => {
    if (!comparison) return 800;
    const points = comparison.speedSeries.length;
    return Math.max(800, Math.min(points * 4, 48000));
  }, [comparison]);

  const summary = comparison?.summary;

  if (!lapOptions.length) {
    return <div className="text-sm text-slate-400">No clean laps available to compare yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-40">
          <Label>Reference Lap</Label>
          <Select
            value={referenceLap ?? ""}
            onChange={e => {
              const val = Number(e.target.value);
              if (!Number.isNaN(val)) onSetReference(val);
            }}
          >
            <option value="" disabled>
              Select lap
            </option>
            {lapOptions.map(l => (
              <option key={`ref-${l.lap}`} value={l.lap}>
                Lap {l.lap}{l.is_best ? " (best)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Label>Compare Lap</Label>
          <Select
            value={compareLap ?? ""}
            onChange={e => {
              const val = Number(e.target.value);
              if (Number.isNaN(val)) {
                onSetCompare(null);
              } else {
                onSetCompare(val);
              }
            }}
          >
            <option value="" disabled>
              Select lap
            </option>
            {lapOptions.map(l => (
              <option key={`cmp-${l.lap}`} value={l.lap}>
                Lap {l.lap}{l.is_best ? " (best)" : ""}
              </option>
            ))}
          </Select>
        </div>
        {summary && (
          <div className="flex grow flex-wrap gap-3">
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Total Δ</div>
              <div className={`mt-1 font-semibold ${summary.totalDelta <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatDelta(summary.totalDelta)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Best Gain</div>
              <div className="mt-1 font-semibold text-emerald-400">
                {summary.bestGain ? `${formatDelta(summary.bestGain.delta)} @ ${formatDistance(summary.bestGain.distance)}` : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Worst Loss</div>
              <div className="mt-1 font-semibold text-rose-400">
                {summary.worstLoss ? `${formatDelta(summary.worstLoss.delta)} @ ${formatDistance(summary.worstLoss.distance)}` : "—"}
              </div>
            </div>
          </div>
        )}
        {highlightRange && (
          <button
            type="button"
            onClick={() => onHighlightClear?.()}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:border-slate-400"
          >
            Clear highlight
          </button>
        )}
      </div>

      {!sessionId && (
        <div className="text-sm text-slate-400">Select a session to compare laps.</div>
      )}

      {sessionId && (!referenceLap || !compareLap) && (
        <div className="text-sm text-slate-400">Choose both a reference and comparison lap.</div>
      )}

      {loading && <div className="text-sm text-slate-400">Loading lap telemetry…</div>}
      {error && <div className="text-sm text-rose-400">{error}</div>}

      {comparison && !loading && !error && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Speed vs Distance</h3>
            <div className="h-64 overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/50">
              <div className="h-full" style={{ minWidth: "100%", width: `${compareWidth}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparison.speedSeries}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="distance"
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${Math.round(v)} m`)}
                      stroke="#334155"
                      tick={{ fontSize: 12, fill: "#cbd5f5" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `${Math.round(v)} kph`}
                      stroke="#334155"
                      tick={{ fontSize: 12, fill: "#cbd5f5" }}
                    />
                    <Tooltip
                      labelFormatter={(v) => formatDistance(typeof v === "number" ? v : Number(v))}
                      formatter={(value, key) => [`${Math.round(Number(value))} kph`, key === "reference" ? "Reference" : "Compare"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#312e81", color: "#e2e8f0" }}
                    />
                    <Line type="monotone" dataKey="reference" stroke="#22d3ee" strokeWidth={2} dot={false} name="Reference" />
                    <Line type="monotone" dataKey="compare" stroke="#a855f7" strokeWidth={2} dot={false} name="Compare" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Δ Time vs Distance</h3>
            <div className="h-60 overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/50">
              <div className="h-full" style={{ minWidth: "100%", width: `${compareWidth}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparison.deltaSeries}>
                    <defs>
                      <linearGradient id="deltaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="distance"
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${Math.round(v)} m`)}
                      stroke="#334155"
                      tick={{ fontSize: 12, fill: "#cbd5f5" }}
                    />
                    <YAxis
                      tickFormatter={(v) => formatDelta(typeof v === "number" ? v : Number(v))}
                      stroke="#334155"
                      tick={{ fontSize: 12, fill: "#cbd5f5" }}
                    />
                    <Tooltip
                      labelFormatter={(v) => formatDistance(typeof v === "number" ? v : Number(v))}
                      formatter={(value: number) => [formatDelta(value), "Δ time"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#312e81", color: "#e2e8f0" }}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                    {highlightRange && (
                      <ReferenceArea
                        x1={highlightRange.start}
                        x2={highlightRange.end}
                        strokeOpacity={0}
                        fill="#facc15"
                        fillOpacity={0.15}
                      />
                    )}
                    <Area type="monotone" dataKey="delta" stroke="#f97316" fill="url(#deltaFill)" fillOpacity={0.4} />
                    <Line type="monotone" dataKey="delta" stroke="#f97316" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
