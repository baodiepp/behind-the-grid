// src/components/SessionPicker.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { getSessions } from "../lib/api";
import type { SessionRow } from "../lib/api";

type Props = {
  value?: number;              // selected session id
  onChange: (id: number) => void;
};

export default function SessionPicker({ value, onChange }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await getSessions();
        if (!alive) return;
        setSessions(list);
        // If parent hasn't chosen a value yet, default to the newest
        if (value == null && list.length) {
          onChange(list[list.length - 1].id);
        }
      } catch (err) {
        if (!alive) return;
        let message = "Failed to load sessions.";
        if (axios.isAxiosError(err)) {
          if (err.response) {
            message = `Server error (${err.response.status}) while loading sessions.`;
          } else if (err.request) {
            message = "Could not reach the telemetry API (network error).";
          } else if (err.message) {
            message = err.message;
          }
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }
        message += " Ensure the backend is running and reachable (configure VITE_API_URL if the API lives elsewhere).";
        setError(message);
        setSessions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]); // runs once (unless retried)

  if (loading) return <div className="text-sm text-slate-400">Loading sessions…</div>;

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-red-400">{error}</div>
        <button
          type="button"
          className="w-fit rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-slate-50 hover:bg-indigo-500"
          onClick={() => setReloadKey(k => k + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-amber-300">No sessions found.</div>
        <button
          type="button"
          className="w-fit rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-slate-50 hover:bg-indigo-500"
          onClick={() => setReloadKey(k => k + 1)}
        >
          Check again
        </button>
      </div>
    );
  }

  return (
    <select
      className="border border-slate-700/80 bg-slate-900 px-3 py-2 text-sm text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500/70 focus:outline-none"
      value={value ?? sessions[0]?.id}
      onChange={e => onChange(Number(e.target.value))}
    >
      {sessions.map(s => (
        <option key={s.id} value={s.id}>
          {s.season} R{s.round} {s.session_type} — {s.circuit}
        </option>
      ))}
    </select>
  );
}
