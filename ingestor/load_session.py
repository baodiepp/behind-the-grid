"""
Ingest one session (all laps) and one driver's telemetry into Postgres.

Targets (from notes/ingest-plan.md):
- SEASON=2023, ROUND=1, SESSION_TYPE="R", DRIVER_CODE="VER"

Environment:
- DATABASE_URL = postgresql://telemetry:telemetry@localhost:5432/telemetry
- FASTF1_CACHE = ~/.fastf1
"""

import os
import psycopg
import fastf1
import pandas as pd
from datetime import datetime, timezone

# TODO: imports you'll need:
# - os
# - psycopg (the modern psycopg3 client)
# - fastf1
# - pandas as pd (optional for convenience)
# - datetime/timezone helpers if needed

def read_config():
    """Read env vars and constants (SEASON, ROUND, SESSION_TYPE, DRIVER_CODE).
    TODO: return a simple dict with all values.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is not set. Run 'export DATABASE_URL=...' in your terminal.")

    cache_dir = os.getenv("FASTF1_CACHE")
    if not cache_dir:
        raise ValueError("FASTF1_CACHE environment variable is not set. Run 'export FASTF1_CACHE=...' in your terminal.")
    
    season = 2023
    round_ = 1
    session_type = "R"
    driver_code = "VER"

    print(f"Using DATABASE_URL={db_url}")
    print(f"Using FASTF1_CACHE={cache_dir}")
    print(f"Using SEASON={season}")
    print(f"Using ROUND={round_}")
    print(f"Using SESSION_TYPE={session_type}")
    print(f"Using DRIVER_CODE={driver_code}")

    return {
        "db_url": db_url,
        "cache_dir": cache_dir,
        "season": season,
        "round": round_,
        "session_type": session_type,
        "driver_code": driver_code
    }

def load_fastf1_session(season, round_, session_type, cache_dir):
    """Enable cache, load the FastF1 session with laps=True, telemetry=True.
    TODO: return the loaded session object (s).
    """
    fastf1.Cache.enable_cache(cache_dir)
    s = fastf1.get_session(season, round_, session_type)
    s.load(laps=True, telemetry=True, weather=False)
    return s

def get_db_connection(database_url):
    """Open a psycopg connection and return it.
    TODO: set autocommit=False so we can manage a transaction.
    """
    conn = psycopg.connect(database_url, autocommit=False)
    return conn

def upsert_session(conn, season, round_, session_type, circuit_name):
    """
    Insert the session row once and reuse on re-runs; return session_id.
    """
    with conn.cursor() as cur:
        # Try to find existing
        cur.execute(
            "SELECT id FROM session WHERE season=%s AND round=%s AND session_type=%s",
            (season, round_, session_type),
        )
        row = cur.fetchone()
        if row:
            return row[0]

        # Insert new
        cur.execute(
            """
            INSERT INTO session(season, round, session_type, circuit)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (season, round_, session_type, circuit_name),
        )
        return cur.fetchone()[0]

def upsert_drivers(conn, driver_pairs):
    """Ensure driver rows exist; return dict {code -> driver_id}.
    TODO: Upsert by unique 'code'.
    """
    code_to_id = {}
    with conn.cursor() as cur:
        for code, name in driver_pairs:
            cur.execute(
                """
                INSERT INTO driver(code, name)
                VALUES (%s, %s)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                """,
                (code, name),
            )
            code_to_id[code] = cur.fetchone()[0]
    return code_to_id

def insert_laps(conn, session_id, code_to_id, laps_df):
    """Insert all laps for all drivers (idempotent).
    TODO: convert lap/sector times to ms; derive compound, is_pit; ON CONFLICT DO NOTHING.
    Return number of rows inserted.
    """
    inserted = 0
    with conn.cursor() as cur:
        # Only select columns we need; avoid chained indexing issues
        cols = [
            "Driver", "LapNumber",
            "LapTime", "Sector1Time", "Sector2Time", "Sector3Time",
            "Compound", "PitOutTime", "PitInTime"
        ]
        df = laps_df[cols].copy()

        # Iterate by row; you can batch later if you like
        for row in df.itertuples(index=False):
            code = row.Driver
            driver_id = code_to_id.get(code)
            if driver_id is None:
                continue  # shouldn’t happen if upsert_drivers was complete

            lap_number = int(row.LapNumber)
            lap_time_ms  = _to_ms(row.LapTime)
            s1_ms        = _to_ms(row.Sector1Time)
            s2_ms        = _to_ms(row.Sector2Time)
            s3_ms        = _to_ms(row.Sector3Time)
            compound     = None if (pd.isna(row.Compound) or str(row.Compound).strip() == "") else str(row.Compound)
            is_pit       = (not pd.isna(row.PitOutTime)) or (not pd.isna(row.PitInTime))

            cur.execute(
                """
                INSERT INTO lap (
                session_id, driver_id, lap_number, lap_time_ms,
                sector_1_ms, sector_2_ms, sector_3_ms, compound, is_pit
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (session_id, driver_id, lap_number) DO NOTHING
                """,
                (
                    session_id,
                    driver_id,
                    lap_number,
                    lap_time_ms,
                    s1_ms,
                    s2_ms,
                    s3_ms,
                    compound,
                    is_pit,
                ),
            )
            inserted += cur.rowcount  # 1 if inserted, 0 if skipped
    return inserted

def extract_driver_telemetry(session_obj, driver_code):
    """Pull per-sample telemetry for driver_code from the loaded session.
    TODO: return an iterable/df with columns: ts (UTC), lap_number, speed_kph, throttle_pct,
          brake_pct, gear, rpm, x, y.
    """
    # Laps for driver in ascending lap order (new API uses pick_drivers)
    laps = session_obj.laps.pick_drivers([driver_code]).sort_values("LapNumber")

    for lap_row in laps.itertuples(index=False):
        lap_no = int(lap_row.LapNumber)

        # Telemetry dataframe for this lap
        tel = session_obj.laps.pick_drivers([driver_code]).pick_laps(lap_no).get_telemetry()
        # Prefer absolute timestamps if available
        if "Date" in tel.columns:
            ts_series = tel["Date"]
            # Make sure tz-aware UTC
            if getattr(ts_series.dt.tz, "zone", None) is None:
                ts_series = ts_series.dt.tz_localize("UTC")
            else:
                ts_series = ts_series.dt.tz_convert("UTC")
        else:
            # Fall back to epoch + relative Time (Timedelta)
            base = pd.Timestamp("1970-01-01", tz="UTC")
            ts_series = base + tel["Time"]

        for i in range(len(tel)):
            # Handle possible NaNs / booleans
            def _f(col, default=0.0):
                v = tel[col].iloc[i] if col in tel.columns else default
                return float(v) if pd.notna(v) else None
            def _i(col):
                v = tel[col].iloc[i] if col in tel.columns else None
                return int(v) if pd.notna(v) else None

            yield (
                ts_series.iloc[i].to_pydatetime(),  # ts (UTC aware)
                lap_no,                              # lap_number
                _f("Speed"),
                _f("Throttle"),
                _f("Brake"),
                _i("nGear"),
                _i("RPM"),
                _f("X", default=None),
                _f("Y", default=None),
            )

def insert_telemetry(conn, session_id, driver_id, telemetry_rows):
    """Insert telemetry samples (idempotent/batched).
    TODO: insert rows ordered by time. Return number of rows inserted.
    """
    batch_size = 5000

    sql = """
        INSERT INTO telemetry (
            ts, session_id, driver_id, lap_number,
            speed_kph, throttle_pct, brake_pct, gear, rpm, x, y
            
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (session_id, driver_id, ts) DO NOTHING
    """
    buf = []
    inserted = 0
    with conn.cursor() as cur:
        for (ts, lap_no, speed, throttle, brake, gear, rpm, x, y) in telemetry_rows:
            buf.append((ts, session_id, driver_id, lap_no, speed, throttle, brake, gear, rpm, x, y))
            if len(buf) >= batch_size:
                cur.executemany(sql, buf)
                inserted += cur.rowcount
                buf.clear()
        if buf:
            cur.executemany(sql, buf)
            inserted += cur.rowcount
    return inserted

def main():
    """Wire the steps together:
    1) read_config
    2) load_fastf1_session
    3) open DB connection; begin transaction
    4) upsert_session -> session_id
    5) upsert_drivers -> code_to_id
    6) insert_laps
    7) extract_driver_telemetry for DRIVER_CODE
    8) insert_telemetry for that driver
    9) commit; print summary counts
    """

    cfg = read_config()
    s = load_fastf1_session(cfg["season"], cfg["round"], cfg["session_type"], cfg["cache_dir"])

    # (code, name) pairs from results table
    res = s.results[["Abbreviation","FullName"]].dropna()
    driver_pairs = list(res.itertuples(index=False, name=None))

    with get_db_connection(cfg["db_url"]) as conn:
        sid = upsert_session(conn, cfg["season"], cfg["round"], cfg["session_type"], s.event["EventName"])
        code_to_id = upsert_drivers(conn, driver_pairs)
        n_laps = insert_laps(conn, sid, code_to_id, s.laps)

        did = code_to_id[cfg["driver_code"]]
        rows = extract_driver_telemetry(s, cfg["driver_code"])
        n_tel = insert_telemetry(conn, sid, did, rows)

        conn.commit()
        print(f"OK: session_id={sid} | laps_inserted={n_laps} | telemetry_inserted={n_tel}")

# Helper to convert pd.Timedelta to milliseconds or None
def _to_ms(t):
    # t may be pandas.Timedelta, NaT, or None
    if pd.isna(t):
        return None
    return int(t.total_seconds() * 1000)



if __name__ == "__main__":
    main()