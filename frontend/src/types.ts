export type SessionRow = {
  id: number;
  season: number;
  round: number;
  session_type: string;
  circuit: string;
};

export type LapRow = {
  lap: number;
  lap_ms: number;
  s1: number;
  s2: number;
  s3: number;
  compound: string | null;
  is_pit: boolean;
  is_best?: boolean;
};

export type TelemetryRow = {
  ts: number;          // seconds epoch (float)
  lap: number;
  speed: number | null;       // kph
  throttle: number | null;    // 0..100
  brake: number | null;       // 0..100
  gear: number | null;
  rpm: number | null;
  x: number | null;    // can be null from some rounds
  y: number | null;
};

export type LapSummaryRow = {
  lap: number;
  lap_ms: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  compound: string | null;
  is_pit: boolean;
  is_out: boolean;
  is_in: boolean;
  delta_ms: number | null;
  delta_s1: number | null;
  delta_s2: number | null;
  delta_s3: number | null;
  has_valid: boolean;
};

export type CornerSummary = {
  corner: number;
  distance_start: number;
  distance_end: number;
  entry_speed: number;
  apex_speed: number;
  exit_speed: number;
  brake_peak: number;
  throttle_exit: number;
  delta_s: number | null;
};
