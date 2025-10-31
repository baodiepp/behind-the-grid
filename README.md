# 🏎️ Behind the Grid

**Behind the Grid** is a full-stack Formula 1 telemetry analysis dashboard that ingests raw race data, stores it in **TimescaleDB**, and visualizes performance metrics through a modern **React + FastAPI** interface.  
It’s built for **engineers, developers, and race strategists** seeking insight into lap performance, pace evolution, and corner-by-corner deltas.

---

## 🚀 Project Overview

- 🧠 **Backend** – FastAPI service (`api/`) serving lap metadata, telemetry, summaries, and analytics like corner atlas and pace trends.  
  Data is stored in **PostgreSQL** with **TimescaleDB** for efficient time-series handling.  
- ⚙️ **Ingestor** – `ingestor/load_session.py` uses **FastF1** to fetch telemetry data for specific seasons, rounds, and drivers, then populates the database.  
- 💻 **Frontend** – Built with **Vite + React + TypeScript**, styled with **Tailwind CSS**, featuring interactive **Recharts** visualizations for telemetry traces, pace, and corner performance.

---

## ✨ Features

- 🗂️ **Session Picker & Lap Table** – Browse all laps in a session; automatically highlights the fastest lap for comparison.  
- 📈 **Telemetry Chart** – Scrollable, zoomable traces with live brushing, scaling, and data-loading indicators.  
- ⚖️ **Lap Comparison** – Compare reference vs. comparison laps with Δ-time vs. distance charts and synced corner highlights.  
- 🧩 **Corner Atlas** – Per-corner metrics (entry/apex/exit speeds, braking, throttle, delta, and losses) with filtering sliders.  
- ⏱️ **Pace & Tire Degradation** – Lap-time evolution with moving averages, tire compound tags, and pit-lap filtering.  
- 🔍 **Analytics API** – Endpoints for lap summaries, corner stats, and aggregated telemetry metrics.

---

## 🧰 Tech Stack

| Category | Technologies |
|-----------|---------------|
| Backend | FastAPI, Python, PostgreSQL, TimescaleDB |
| Frontend | React, TypeScript, Vite, TailwindCSS, Recharts |
| DevOps | Docker, Docker Compose |
| Data | FastF1 Telemetry API |
| Tools | VS Code, Git, Swagger UI |

---

## ⚡ Getting Started

### 🧩 Prerequisites

- Python 3.12+  
- Node.js 18+  
- Docker (for TimescaleDB)  

### 🏁 1. Clone & Setup

```bash
git clone <repo-url>
cd behind-the-grid
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
npm install --prefix frontend
```

### 🗄️ 2. Start Database

```bash
docker compose up -d db
```
TimescaleDB runs on `localhost:5432` using credentials `telemetry / telemetry`.

### ⚙️ 3. Set Environment Variables

```bash
export DATABASE_URL="postgresql://telemetry:telemetry@localhost:5432/telemetry"
export FASTF1_CACHE="$HOME/.fastf1"
```

### 🧾 4. Ingest a Session

```bash
. .venv/bin/activate
python ingestor/load_session.py
```

### 🖥️ 5. Run the Backend

```bash
uvicorn api.app:app --reload --port 8000
```
Access API docs at → [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 💻 6. Run the Frontend

```bash
cd frontend
npm run dev
```
Open → [http://localhost:5173](http://localhost:5173)

---

## 🔗 Key Endpoints

| Endpoint | Description |
|-----------|-------------|
| `/sessions` | List all available sessions |
| `/laps?session_id&driver_code` | Fetch laps with best lap flags |
| `/telemetry` | Return full telemetry data with coordinates |
| `/laps/summary` | Get per-lap metrics and delta to session best |
| `/laps/corners` | Return detailed corner performance metrics |
| `/lap_summaries` | Average/max speed, throttle, and brake per lap |

---

## 🧱 Frontend Structure

```
frontend/
├── src/
│   ├── App.tsx              # Main dashboard layout
│   ├── components/          # Modular charts, tables, cards
│   └── lib/api.ts           # Axios client & endpoint wrappers
├── tailwind.config.js
└── postcss.config.js
```

---

## 🧪 Common Scripts

| Command | Description |
|----------|-------------|
| `docker compose up -d db` | Launch TimescaleDB |
| `python ingestor/load_session.py` | Ingest session telemetry |
| `uvicorn api.app:app --reload` | Start backend |
| `npm run dev` | Run frontend in dev mode |
| `npm run build` | Build production frontend |
| `npm run lint` | Lint frontend code |

---

## 🧭 Troubleshooting

- ⚠️ **Blank UI** → Ensure FastAPI (port 8000) and Vite (port 5173) are both running.  
- 🏎️ **No Sessions** → Verify ingestion succeeded and `DATABASE_URL` is correct.  
- 🧠 **Corner Atlas Empty** → Adjust `/laps/corners` parameters or ensure throttle/brake data is present.  
- 🐢 **Slow Ingest** → FastF1 caches data; subsequent runs are faster.

---

## 🧩 Roadmap

- 🔁 Cross-driver lap comparison  
- 🧭 Multi-session overlays (pace evolution)  
- 🗺️ Sector-colored track visualization  
- 🔐 User authentication & shareable dashboards  

---

## 💬 Contributing

Pull requests are welcome!  
If you’d like to contribute new features, enhancements, or telemetry datasets, feel free to fork and submit a PR.

---

## 🏁 License

MIT © 2025 **Bao Diep**
