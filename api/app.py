from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Query
import psycopg, os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.environ["DATABASE_URL"]

def db(): return psycopg.connect(DB_URL, autocommit=False)

@app.get("/health")
def health(): return {"ok": True}

@app.get("/sessions")
def sessions():
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, season, round, session_type, circuit FROM session ORDER BY season, round, session_type")
        rows = cur.fetchall()
    return [dict(id=r[0], season=r[1], round=r[2], session_type=r[3], circuit=r[4]) for r in rows]

@app.get("/laps")
def laps(session_id: int, driver_code: str):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM driver WHERE code=%s", (driver_code,))
        r = cur.fetchone()
        if not r: return []
        did = r[0]
        cur.execute("""
          SELECT lap_number, lap_time_ms, sector_1_ms, sector_2_ms, sector_3_ms, compound, is_pit
          FROM lap WHERE session_id=%s AND driver_id=%s ORDER BY lap_number
        """, (session_id, did))
        rows = cur.fetchall()
    keys = ["lap","lap_ms","s1","s2","s3","compound","is_pit"]
    return [dict(zip(keys, row)) for row in rows]

@app.get("/telemetry")
def telemetry(session_id: int, driver_code: str, lap_number: int | None = None, limit: int = Query(5000, le=50000)):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM driver WHERE code=%s", (driver_code,))
        r = cur.fetchone()
        if not r: return []
        did = r[0]
        base_sql = """
          SELECT EXTRACT(EPOCH FROM ts) AS ts, lap_number, speed_kph, throttle_pct, brake_pct, gear, rpm, x, y
          FROM telemetry
          WHERE session_id=%s AND driver_id=%s
        """
        args = [session_id, did]
        if lap_number is not None:
            base_sql += " AND lap_number=%s"
            args.append(lap_number)
        base_sql += " ORDER BY ts"
        if lap_number is None:
            base_sql += " LIMIT %s"
            args.append(limit)

        cur.execute(base_sql, args)
        rows = cur.fetchall()
    keys = ["ts","lap","speed","throttle","brake","gear","rpm","x","y"]
    return [dict(zip(keys, row)) for row in rows]