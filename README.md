
# Telemetry Dash

Telemetry Dash is a full-stack F1 telemetry explorer that lets you ingest raw Formula 1 session data, store it in TimescaleDB, and interactively analyze it in a modern React dashboard. It is designed for hobbyists, engineers, and race strategists who want rapid insight into lap performance, pace evolution, and corner-by-corner deltas.

## Project Overview

- **Backend**: FastAPI service (`api/`) that serves lap metadata, detailed telemetry, lap summaries, and derived analytics (corner atlas, pace trends). Data is stored in PostgreSQL with the TimescaleDB extension to handle high-resolution time series.
- **Ingestor**: `ingestor/load_session.py` pulls FastF1 telemetry for a specific season/round/session/driver and populates the database. The default dataset is Red Bull driver VER (Max Verstappen) in the 2023 season opener (Bahrain GP race).
- **Frontend**: Vite + React + TypeScript app (`frontend/`) styled with Tailwind, featuring responsive cards, tables, and interactive Recharts plots for pace, telemetry traces, and corner analytics.

## Features

- **Session Picker & Lap Table**: Browse laps for a selected session/driver. Auto-selects fastest lap as the reference and toggles focus/compare laps with visual highlights.
- **Telemetry Chart**: Scrollable, zoomable speed trace with scale slider, brush, and loading indicator.
- **Lap Compare**: Overlays reference vs. comparison lap speed, and renders Δ-time vs. distance with tooltips, highlight range, and direct integration with corner atlas.
- **Corner Atlas**: Per-corner breakdown of entry/apex/exit speeds, peak brake/throttle, delta time, and top-loss badge with toggle between top 8 and full set of corners (≈20 per lap). Includes |Δt| threshold slider and highlight sync.
- **Pace & Tire Degradation Panel**: Lap-time trend with optional 3-lap moving average, sector Δ stacked bars, compound badges, and clean vs. pit-lap filter.
- **API Analytics**: `/laps/summary`, `/laps/corners`, `/lap_summaries` endpoints calculate best lap deltas, sector contributions, and corner-level metrics with configurable thresholds.

## Getting Started

### Prerequisites

- Python 3.12+ (ideally using the provided `.venv` virtual environment)
- Node.js 18+ (for the frontend Vite app)
- Docker (for TimescaleDB via docker-compose)

### 1. Clone and Setup

```bash
git clone <repo-url>
cd telemetry-dash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt  # if you export requirements
npm install --prefix frontend
```

Current Python dependencies are managed via the venv; the frontend has a `package-lock.json` checked in.

### 2. Start the Database

```bash
docker compose up -d db
```

TimescaleDB will be exposed on `localhost:5432` with credentials `telemetry / telemetry` (default in `docker-compose.yml`).

### 3. Set Environment Variables

```bash
export DATABASE_URL="postgresql://telemetry:telemetry@localhost:5432/telemetry"
export FASTF1_CACHE="$HOME/.fastf1"
```

These are required by both the ingestor and the FastAPI backend. Create the cache directory if it doesn’t exist.

### 4. Ingest a Session

```bash
. .venv/bin/activate
python ingestor/load_session.py
```

The script loads the configured session (2023 R1 VER by default) into the database. It inserts sessions, drivers, lap times, and telemetry rows with XY coordinates and pedal traces.

### 5. Run the Backend

```bash
. .venv/bin/activate
uvicorn api.app:app --reload --port 8000
```

The API provides JSON endpoints used by the React app. Visit `http://127.0.0.1:8000/docs` for auto-generated Swagger docs.

### 6. Run the Frontend

```bash
cd frontend
npm run dev
```

By default Vite serves on `http://localhost:5173`. Ensure CORS origins match (`api/app.py` already allows localhost ports).

## Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/sessions` | List available sessions from the database |
| `/laps?session_id&driver_code` | Return lap table with best lap flag |
| `/telemetry?session_id&driver_code&lap_number` | High-resolution telemetry with XY coordinates |
| `/laps/summary` | Lap metrics with delta to session best, pit flags |
| `/laps/corners` | Corner atlas metrics; accepts tunable detection params |
| `/lap_summaries` | Aggregated telemetry (avg/max speed, throttle, brake per lap) |

## Frontend Structure

- `src/App.tsx`: Main dashboard layout, orchestrating SessionPicker, LapCompare, CornerAtlas, and PacePanel.
- `src/components/`: Modular UI components (cards, tables, charts) including LapCompare, PacePanel, CornerAtlas, etc.
- `src/lib/api.ts`: Axios client + typed wrappers for API endpoints.
- `tailwind.config.js`, `postcss.config.js`: Tailwind CSS configuration.

## Scripts

- `docker compose up -d db` — launch TimescaleDB
- `python ingestor/load_session.py` — ingest session telemetry
- `uvicorn api.app:app --reload` — start FastAPI backend
- `npm run dev` (from `frontend`) — run React development server
- `npm run build` — TypeScript + Vite production build
- `npm run lint` — ESLint checks

## Troubleshooting

- **Blank UI**: Ensure both FastAPI (port 8000) and Vite (port 5173) are running; check browser dev tools for API errors.
- **No Sessions**: Verify the ingest script ran successfully and `DATABASE_URL` points to the correct database.
- **Corner Atlas empty**: Adjust thresholds via query params (`/laps/corners` supports `on`, `off`, `exit_thr`, `min_len`, `min_drop_kph`, `min_peak_brake`, `scale01`) or confirm brake/throttle data exists.
- **Slow ingest**: FastF1 may take time on first download; subsequent runs use cached data.

## Roadmap Ideas

- Compare drivers within the same session (cross-driver lap compare)
- Session overlay charts (pace evolution across compounds)
- Track map visualization enhancements (sector coloring by delta)
- Authentication and multi-user shareable dashboards


