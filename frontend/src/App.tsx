// src/App.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { getLaps, getTelemetry } from "./lib/api";
import type { LapRow, TelemetryRow } from "./lib/api";
import { Card, CardBody, Label, Select, Stat } from "./components/ui";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush } from "recharts";
import SessionPicker from "./components/SessionPicker";
import LapCompare from "./components/LapCompare";
import CornerAtlas from "./components/CornerAtlas";
import PacePanel from "./components/PacePanel";

function msToLap(ms?: number) {
  if (!ms || ms <= 0) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export default function App() {
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const [driver, setDriver] = useState("VER");
  const [laps, setLaps] = useState<LapRow[]>([]);
  const [focusLap, setFocusLap] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [loadingTel, setLoadingTel] = useState(false);
  const [chartScale, setChartScale] = useState(1.5);
  const [referenceLap, setReferenceLap] = useState<number | null>(null);
  const [compareLap, setCompareLap] = useState<number | null>(null);
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getLaps({ session_id: sessionId, driver_code: driver })
      .then(data => {
        setLaps(data);
        setFocusLap(prev => (prev && data.some(l => l.lap === prev)) ? prev : null);
        setReferenceLap(prev => {
          if (prev && data.some(l => l.lap === prev)) return prev;
          const best = data.find(l => l.is_best);
          return best ? best.lap : prev ?? null;
        });
        setCompareLap(prev => {
          if (prev && data.some(l => l.lap === prev)) return prev;
          const best = data.find(l => l.is_best);
          const candidate = data.find(l => !l.is_pit && l.lap_ms && (!best || l.lap !== best.lap));
          if (candidate) return candidate.lap;
          if (best) return best.lap;
          return null;
        });
      });
  }, [sessionId, driver]);

  useEffect(() => {
    if (!sessionId) return;
    setLoadingTel(true);
    getTelemetry({ session_id: sessionId, driver_code: driver, lap_number: focusLap ?? undefined, limit: 50000 })
      .then(data => setTelemetry(data))
      .finally(() => setLoadingTel(false));
  }, [sessionId, driver, focusLap]);

  const avgThrottle = useMemo(
    () => telemetry.length ? telemetry.reduce((a,b)=>a+(b.throttle||0),0)/telemetry.length : 0,
    [telemetry]
  );
  const avgBrake = useMemo(
    () => telemetry.length ? telemetry.reduce((a,b)=>a+(b.brake||0),0)/telemetry.length : 0,
    [telemetry]
  );
  const maxSpeed = useMemo(
    () => telemetry.reduce((m,t)=>Math.max(m, t.speed||0), 0),
    [telemetry]
  );

  const chartPixelWidth = useMemo(() => {
    if (!telemetry.length) return 800;
    const density = focusLap ? 4 : 1.6;
    const base = Math.min(Math.max(telemetry.length * density, 800), 32000);
    return Math.min(base * chartScale, 48000);
  }, [telemetry, focusLap, chartScale]);

  const handleReferenceChange = useCallback((lap: number) => {
    setReferenceLap(lap);
    setHighlightRange(null);
  }, []);

  const handleCompareChange = useCallback((lap: number | null) => {
    setCompareLap(lap);
    setHighlightRange(null);
  }, []);

  const bestLapNumber = useMemo(() => {
    const candidate = laps.find(l => l.is_best && !l.is_pit && l.lap_ms);
    return candidate?.lap ?? null;
  }, [laps]);

  useEffect(() => {
    setHighlightRange(null);
  }, [referenceLap, compareLap]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-100 grow">F1 Telemetry Dashboard</h1>
          <div className="flex flex-wrap justify-end gap-3">
            <div className="w-full sm:w-72">
              <Label>Session</Label>
              <SessionPicker value={sessionId} onChange={setSessionId} />
            </div>
            <div className="w-full sm:w-40">
              <Label>Driver</Label>
              <Select value={driver} onChange={e=>setDriver(e.target.value)}>
                {["VER","PER","ALO","HAM","LEC","SAI","RUS","NOR","PIA","ALB","GAS","OCO","STR","BOT","ZHO","MAG","HUL","TSU","SAR","DEV"].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-6">
        <div className="col-span-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat label="Avg Throttle" value={`${avgThrottle.toFixed(1)} %`} />
          <Stat label="Avg Brake" value={`${avgBrake.toFixed(1)} %`} />
          <Stat label="Max Speed" value={`${maxSpeed.toFixed(1)} kph`} />
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Card>
            <CardBody>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-200">Laps</h2>
                <div className="flex items-center gap-2">
                  {bestLapNumber != null && referenceLap !== bestLapNumber && (
                    <button
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-indigo-400"
                      onClick={() => handleReferenceChange(bestLapNumber)}
                    >
                      Use fastest as reference
                    </button>
                  )}
                  {focusLap && (
                    <button
                      className="text-xs text-indigo-400 hover:underline"
                      onClick={() => setFocusLap(null)}
                    >
                      clear focus
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full text-sm text-slate-200">
                  <thead className="sticky top-0 bg-slate-900/80 backdrop-blur">
                    <tr className="text-slate-400">
                      <th className="px-2 py-2 text-left font-medium">Lap</th>
                      <th className="px-2 py-2 text-left font-medium">Lap Time</th>
                      <th className="px-2 py-2 text-left font-medium">S1</th>
                      <th className="px-2 py-2 text-left font-medium">S2</th>
                      <th className="px-2 py-2 text-left font-medium">S3</th>
                      <th className="px-2 py-2 text-left font-medium">Cmpd</th>
                      <th className="px-2 py-2 text-left font-medium">Pit</th>
                      <th className="px-2 py-2 text-left font-medium">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laps.map(l => (
                      <tr
                        key={l.lap}
                        onClick={() => {
                          const next = focusLap === l.lap ? null : l.lap;
                          setFocusLap(next);
                          if (next) setCompareLap(l.lap);
                          setHighlightRange(null);
                        }}
                        className={`cursor-pointer transition-colors hover:bg-indigo-950/40 ${focusLap === l.lap ? "bg-indigo-900/40" : ""} ${compareLap === l.lap ? "ring-1 ring-indigo-500/60" : ""}`}
                      >
                        <td className={`px-2 py-1 font-medium ${referenceLap === l.lap ? "text-indigo-300" : "text-slate-100"}`}>
                          {l.lap}{l.is_best ? " ★" : ""}
                          {compareLap === l.lap && <span className="ml-2 text-xs text-indigo-400">cmp</span>}
                          {referenceLap === l.lap && <span className="ml-1 text-xs text-slate-400">ref</span>}
                        </td>
                        <td className="px-2 py-1 tabular-nums">{msToLap(l.lap_ms)}</td>
                        <td className="px-2 py-1 tabular-nums">{msToLap(l.s1)}</td>
                        <td className="px-2 py-1 tabular-nums">{msToLap(l.s2)}</td>
                        <td className="px-2 py-1 tabular-nums">{msToLap(l.s3)}</td>
                        <td className="px-2 py-1 text-slate-300">{l.compound ?? "-"}</td>
                        <td className="px-2 py-1">{l.is_pit ? "🅿︎" : ""}</td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReferenceLap(l.lap);
                              if (compareLap == null) setCompareLap(l.lap);
                            }}
                            className={`rounded px-2 py-1 text-xs font-medium ${referenceLap === l.lap ? "text-slate-400" : "text-indigo-400 hover:text-indigo-300"}`}
                            disabled={referenceLap === l.lap}
                          >
                            {referenceLap === l.lap ? "Active" : "Use"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card>
            <CardBody className="h-[70vh]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-200">
                  {focusLap ? `Speed — Lap ${focusLap}` : `Speed — Whole session`}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Scale</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.25}
                      value={chartScale}
                      onChange={e => setChartScale(Number(e.target.value))}
                      className="h-1 w-28 accent-indigo-500"
                    />
                    <span className="tabular-nums text-slate-300">{chartScale.toFixed(2)}×</span>
                  </div>
                  {loadingTel && <div className="text-xs text-slate-400">loading…</div>}
                </div>
              </div>
              <div className="h-full">
                {telemetry.length ? (
                  <div className="h-full overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/50">
                    <div className="h-full" style={{ minWidth: "100%", width: `${chartPixelWidth}px` }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={telemetry}>
                          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                          <XAxis
                            dataKey="ts"
                            type="number"
                            domain={["auto","auto"]}
                            tickFormatter={(v)=>new Date(v*1000).toLocaleTimeString()}
                            tick={{ fontSize: 12, fill: "#cbd5f5" }}
                            stroke="#334155"
                          />
                          <YAxis yAxisId="speed" tick={{ fontSize: 12, fill: "#cbd5f5" }} stroke="#334155" />
                          <Tooltip
                            labelFormatter={(v)=>new Date(v*1000).toLocaleTimeString()}
                            formatter={(v: number, k) => [v.toFixed(1), k]}
                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#312e81", color: "#e2e8f0" }}
                          />
                          <Brush dataKey="ts" height={24} stroke="#6366f1" travellerWidth={10} fill="#1e1b4b" />
                          <Line yAxisId="speed" type="monotone" dataKey="speed" dot={false} strokeWidth={2} stroke="#6366f1" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No telemetry for this selection.
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardBody className="space-y-4">
              <LapCompare
                sessionId={sessionId}
                driver={driver}
                referenceLap={referenceLap}
                compareLap={compareLap}
                laps={laps}
                onSetReference={handleReferenceChange}
                onSetCompare={handleCompareChange}
                highlightRange={highlightRange}
                onHighlightClear={() => setHighlightRange(null)}
              />
            </CardBody>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardBody className="space-y-4">
              <CornerAtlas
                sessionId={sessionId}
                driver={driver}
                referenceLap={referenceLap}
                compareLap={compareLap}
                highlightRange={highlightRange}
                onSelectRange={setHighlightRange}
              />
            </CardBody>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardBody className="space-y-4">
              <PacePanel
                sessionId={sessionId}
                driver={driver}
                referenceLap={referenceLap}
                compareLap={compareLap}
                onSetReference={handleReferenceChange}
                onSetCompare={handleCompareChange}
              />
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
