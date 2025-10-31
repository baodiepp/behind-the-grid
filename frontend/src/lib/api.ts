import axios from "axios";
import type { LapRow, SessionRow, TelemetryRow, LapSummaryRow, CornerSummary } from "../types";

const DEFAULT_API_PORT = 8000;

function resolveBaseURL(): string {
  const fromEnv =
    typeof import.meta !== "undefined" && typeof import.meta.env?.VITE_API_URL === "string"
      ? import.meta.env.VITE_API_URL.trim()
      : "";
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://127.0.0.1:${DEFAULT_API_PORT}`;
}

const baseURL = resolveBaseURL();

export const api = axios.create({
  baseURL,
  timeout: 20000,
});

export type { LapRow, SessionRow, TelemetryRow, CornerSummary };

export async function getSessions(): Promise<SessionRow[]> {
  const res = await api.get<SessionRow[]>("/sessions");
  return res.data ?? [];
}

type LapQuery = {
  session_id: number;
  driver_code: string;
};

export async function getLaps(params: LapQuery): Promise<LapRow[]> {
  const res = await api.get<LapRow[]>("/laps", { params });
  return res.data ?? [];
}

type TelemetryQuery = {
  session_id: number;
  driver_code: string;
  lap_number?: number;
  limit?: number;
};

export async function getTelemetry(params: TelemetryQuery): Promise<TelemetryRow[]> {
  const res = await api.get<TelemetryRow[]>("/telemetry", { params });
  return res.data ?? [];
}

type LapSummary = {
  lap: number;
  n: number;
  avg_speed: number | null;
  max_speed: number | null;
  avg_throttle: number | null;
  avg_brake: number | null;
};

export async function getLapSummaries(params: LapQuery): Promise<LapSummary[]> {
  const res = await api.get<LapSummary[]>("/lap_summaries", { params });
  return res.data ?? [];
}

export async function getLapSummary(params: LapQuery): Promise<LapSummaryRow[]> {
  const res = await api.get<LapSummaryRow[]>("/laps/summary", { params });
  return res.data ?? [];
}

type CornerAtlasResponse = {
  corners: CornerSummary[];
  top_losses: Array<{ corner: number; delta_s: number | null }>;
};

type CornerAtlasQuery = LapQuery & {
  reference_lap: number;
  compare_lap?: number | null;
  step?: number;
  on?: number;
  off?: number;
  exit_thr?: number;
  min_len?: number;
  min_drop_kph?: number;
  min_time?: number;
  min_peak_brake?: number;
  scale01?: boolean;
};

export async function getCornerAtlas(params: CornerAtlasQuery): Promise<CornerAtlasResponse> {
  const res = await api.get<CornerAtlasResponse>("/laps/corners", { params });
  return res.data ?? { corners: [], top_losses: [] };
}
