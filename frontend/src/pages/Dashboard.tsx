// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { getLaps, getSessions, getTelemetry } from "../lib/api";
import type { LapRow, TelemetryRow } from "../lib/api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";

const DEFAULT_DRIVER = "VER";

export default function Dashboard() {
  const [laps, setLaps] = useState<LapRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const sessions = await getSessions();
        const latest = sessions.at(-1);
        if (!latest) {
          setErr("No sessions available.");
          setLaps([]);
          setTelemetry([]);
          return;
        }
        setSessionName(`${latest.season} R${latest.round} ${latest.session_type}`);
        const [lapData, telData] = await Promise.all([
          getLaps({ session_id: latest.id, driver_code: DEFAULT_DRIVER }),
          getTelemetry({ session_id: latest.id, driver_code: DEFAULT_DRIVER, limit: 10000 })
        ]);
        setLaps(lapData);
        setTelemetry(telData);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load data.";
        setErr(message);
        setLaps([]);
        setTelemetry([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Average speed per lap (kph)
  const avgSpeedPerLap = useMemo(() => {
    const byLap = new Map<number, { sum: number; n: number }>();
    telemetry.forEach(r => {
      const key = r.lap;
      const entry = byLap.get(key) ?? { sum: 0, n: 0 };
      entry.sum += Number(r.speed ?? 0);
      entry.n += 1;
      byLap.set(key, entry);
    });
    return Array.from(byLap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([lap, { sum, n }]) => ({ lap: `Lap ${lap}`, avgSpeed: n ? sum / n : 0 }));
  }, [telemetry]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Telemetry Dash</h1>
          <div className="text-sm text-gray-500">{sessionName}</div>
        </div>
        <span className="text-sm text-gray-500">Driver: {DEFAULT_DRIVER}</span>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Laps</div>
          <div className="text-3xl font-semibold">{laps.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Telemetry Samples</div>
          <div className="text-3xl font-semibold">{telemetry.length.toLocaleString()}</div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Average Speed per Lap</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={avgSpeedPerLap}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="lap" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Line type="monotone" dataKey="avgSpeed" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
