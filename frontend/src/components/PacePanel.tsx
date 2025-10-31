import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getLapSummary } from "../lib/api";
import type { LapSummaryRow } from "../types";

type Props = {
  sessionId?: number;
  driver: string;
  referenceLap: number | null;
  compareLap: number | null;
  onSetReference: (lap: number) => void;
  onSetCompare: (lap: number | null) => void;
};

type PaceRow = LapSummaryRow & {
  lapSeconds: number | null;
  deltaSeconds: number | null;
  deltaS1Seconds: number;
  deltaS2Seconds: number;
  deltaS3Seconds: number;
  maSeconds: number | null;
};

const compoundColors: Record<string, string> = {
  SOFT: "#f87171",
  MEDIUM: "#facc15",
  HARD: "#60a5fa",
  INTERMEDIATE: "#34d399",
  WET: "#38bdf8",
  C1: "#60a5fa",
  C2: "#facc15",
  C3: "#f97316",
  C4: "#ef4444",
  C5: "#f43f5e",
};

const sectorColors = {
  deltaS1Seconds: "#22d3ee",
  deltaS2Seconds: "#f97316",
  deltaS3Seconds: "#a855f7",
} as const;

const movingAverageWindow = 3;

function formatLapTime(ms?: number | null): string {
  if (!ms || ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function formatSecondsAsLap(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) return "—";
  return formatLapTime(seconds * 1000);
}

function formatDeltaSeconds(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "±";
  const abs = Math.abs(seconds);
  return `${sign}${abs.toFixed(3)}s`;
}

function formatDistanceLabel(value: number): string {
  return `Lap ${value}`;
}

export default function PacePanel({
  sessionId,
  driver,
  referenceLap,
  compareLap,
  onSetReference,
  onSetCompare,
}: Props) {
  const [rows, setRows] = useState<PaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidePit, setHidePit] = useState(true);
  const [showMA, setShowMA] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setRows([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getLapSummary({ session_id: sessionId, driver_code: driver })
      .then(data => {
        if (!active) return;
        const enriched: PaceRow[] = data.map(row => ({
          ...row,
          lapSeconds: row.lap_ms != null ? row.lap_ms / 1000 : null,
          deltaSeconds: row.delta_ms != null ? row.delta_ms / 1000 : null,
          deltaS1Seconds: row.delta_s1 != null ? row.delta_s1 / 1000 : 0,
          deltaS2Seconds: row.delta_s2 != null ? row.delta_s2 / 1000 : 0,
          deltaS3Seconds: row.delta_s3 != null ? row.delta_s3 / 1000 : 0,
          maSeconds: null,
        }));

        // Moving average over valid laps (trailing window)
        for (let i = 0; i < enriched.length; i += 1) {
          const windowStart = Math.max(0, i - movingAverageWindow + 1);
          const slice = enriched.slice(windowStart, i + 1).map(item => item.lapSeconds).filter((n): n is number => n != null);
          const avg = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
          enriched[i].maSeconds = avg;
        }

        setRows(enriched);
      })
      .catch(err => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load lap summary.");
        setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [sessionId, driver]);

  const filteredRows = useMemo(() => {
    if (hidePit) {
      return rows.filter(row => !row.is_pit && !row.is_out && !row.is_in);
    }
    return rows;
  }, [rows, hidePit]);

  const bestLap = useMemo(() => {
    return rows.reduce<PaceRow | null>((best, row) => {
      if (row.lap_ms == null || row.lap_ms <= 0) return best;
      if (row.is_pit || row.is_out || row.is_in) return best;
      if (!best || (best.lap_ms != null && row.lap_ms < best.lap_ms)) return row;
      return best;
    }, null);
  }, [rows]);

  const compoundBadges = useMemo(() => {
    const map = new Map<string, PaceRow>();
    rows.forEach(row => {
      if (!row.compound || row.lap_ms == null || row.lap_ms <= 0) return;
      if (row.is_pit || row.is_out || row.is_in) return;
      const existing = map.get(row.compound);
      if (!existing || (existing.lap_ms != null && row.lap_ms < existing.lap_ms)) {
        map.set(row.compound, row);
      }
    });
    return Array.from(map.entries())
      .map(([compound, row]) => ({ compound, row }))
      .sort((a, b) => (a.row.lap_ms ?? Number.MAX_SAFE_INTEGER) - (b.row.lap_ms ?? Number.MAX_SAFE_INTEGER));
  }, [rows]);

  const trendData = useMemo(() => {
    return filteredRows.map(row => ({
      ...row,
      maSeconds: showMA ? row.maSeconds : null,
    }));
  }, [filteredRows, showMA]);

  const handleLapClick = (lap: number | null | undefined) => {
    if (!lap) return;
    if (bestLap && referenceLap == null) {
      onSetReference(bestLap.lap);
    } else if (bestLap && referenceLap !== bestLap.lap) {
      onSetReference(bestLap.lap);
    }
    onSetCompare(lap);
  };

  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) {
      return <circle cx={0} cy={0} r={0} fill="transparent" />;
    }
    const { compound, is_pit: pit, is_out: out, is_in: inn, lap } = payload;
    const color = compoundColors[(compound ?? "").toUpperCase()] ?? "#94a3b8";
    const opacity = pit || out || inn ? 0.35 : 1;
    const radius = compareLap === lap ? 5 : 3;
    return <circle cx={cx} cy={cy} r={radius} fill={color} fillOpacity={opacity} stroke="none" />;
  };

  const renderStackBar = (props: any) => {
    const { payload, fill } = props;
    const opacity = payload?.is_pit || payload?.is_out || payload?.is_in ? 0.35 : 0.85;
    const highlight = compareLap != null && payload?.lap === compareLap;
    return (
      <Rectangle
        {...props}
        fill={fill}
        fillOpacity={opacity}
        stroke={highlight ? "#facc15" : undefined}
        strokeWidth={highlight ? 1.5 : 0}
      />
    );
  };

  const deltaTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0].payload as PaceRow;
    const deltaString = formatDeltaSeconds(entry.deltaSeconds);
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
        <div className="font-semibold">Lap {entry.lap}</div>
        <div>{formatLapTime(entry.lap_ms)}</div>
        <div className="mt-1">
          {deltaString} (
          <span className="text-cyan-300">S1 {formatDeltaSeconds(entry.deltaS1Seconds)}</span>,{" "}
          <span className="text-amber-300">S2 {formatDeltaSeconds(entry.deltaS2Seconds)}</span>,{" "}
          <span className="text-fuchsia-300">S3 {formatDeltaSeconds(entry.deltaS3Seconds)}</span>
          )
        </div>
        {entry.compound && <div className="mt-1 text-slate-400 uppercase">Compound: {entry.compound}</div>}
        {(entry.is_pit || entry.is_in || entry.is_out) && (
          <div className="text-[10px] uppercase text-slate-500">
            {entry.is_pit ? "Pit Lap" : entry.is_out ? "Out Lap" : "In Lap"}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-200">Pace &amp; Tire Degradation</h2>
        <button
          type="button"
          onClick={() => setHidePit(v => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            hidePit ? "border-indigo-500 bg-indigo-600/20 text-indigo-200" : "border-slate-600 text-slate-300 hover:border-slate-400"
          }`}
        >
          {hidePit ? "Showing clean laps" : "Including pit laps"}
        </button>
        <button
          type="button"
          onClick={() => setShowMA(v => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            showMA ? "border-emerald-500 bg-emerald-600/20 text-emerald-200" : "border-slate-600 text-slate-300 hover:border-slate-400"
          }`}
        >
          {showMA ? "MA On (3 lap)" : "MA Off"}
        </button>
        {compoundBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {compoundBadges.map(({ compound, row }) => (
              <div
                key={compound}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] uppercase text-slate-200"
              >
                <span className="font-semibold" style={{ color: compoundColors[compound] ?? "#cbd5f5" }}>
                  {compound}
                </span>{" "}
                Lap {row.lap} — {formatLapTime(row.lap_ms)}
              </div>
            ))}
          </div>
        )}
      </div>

      {!sessionId && <div className="text-sm text-slate-400">Select a session to view pace trends.</div>}
      {loading && <div className="text-sm text-slate-400">Loading lap pace…</div>}
      {error && <div className="text-sm text-rose-400">{error}</div>}

      {trendData.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Lap Time Trend</h3>
            <div className="h-64 overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/50">
              <div className="h-full min-w-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="lap" stroke="#334155" tick={{ fontSize: 12, fill: "#cbd5f5" }} />
                    <YAxis
                      stroke="#334155"
                      tick={{ fontSize: 12, fill: "#cbd5f5" }}
                      tickFormatter={(v) => `${v.toFixed(3)}s`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      labelFormatter={(v) => formatDistanceLabel(Number(v))}
                      formatter={(value: number, key: string, payload: any) => {
                        if (value == null) return ["—", key];
                        if (key === "maSeconds") return [`${value.toFixed(3)}s`, "3-lap MA"];
                        if (key === "lapSeconds") return [formatSecondsAsLap(value), "Lap Time"];
                        return [formatLapTime(payload.lap_ms), "Lap Time"];
                      }}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#312e81", color: "#e2e8f0" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="lapSeconds"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={renderDot}
                      connectNulls
                      activeDot={{ r: 5 }}
                    />
                    {showMA && (
                      <Line
                        type="monotone"
                        dataKey="maSeconds"
                        stroke="#34d399"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        name="3-lap MA"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Δ to Best Lap (Sector Breakdown)</h3>
              <div className="text-[11px] text-slate-500">
                Click a bar to compare that lap with the reference.
              </div>
            </div>
            <div className="h-64 overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/50">
              <div className="h-full min-w-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trendData}
                    margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                    onClick={(chart: any) => {
                      const lap = chart?.activePayload?.[0]?.payload?.lap as number | undefined;
                      if (lap) handleLapClick(lap);
                    }}
                  >
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="lap" stroke="#334155" tick={{ fontSize: 12, fill: "#cbd5f5" }} />
                    <YAxis
                      stroke="#334155"
                      tick={{ fontSize: 12, fill: "#cbd5f5" }}
                      tickFormatter={(v) => formatDeltaSeconds(Number(v))}
                    />
                    <Tooltip content={deltaTooltip} />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                    <Bar
                      dataKey="deltaS1Seconds"
                      stackId="delta"
                      fill={sectorColors.deltaS1Seconds}
                      shape={renderStackBar}
                      name="S1"
                    />
                    <Bar
                      dataKey="deltaS2Seconds"
                      stackId="delta"
                      fill={sectorColors.deltaS2Seconds}
                      shape={renderStackBar}
                      name="S2"
                    />
                    <Bar
                      dataKey="deltaS3Seconds"
                      stackId="delta"
                      fill={sectorColors.deltaS3Seconds}
                      shape={renderStackBar}
                      name="S3"
                    />
                    <Area
                      type="monotone"
                      dataKey="deltaSeconds"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.12}
                      name="Total Δ"
                    />
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
