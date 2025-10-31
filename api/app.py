# api/app.py
import math
import os
import psycopg
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    # (or use the regex below instead of allow_origins if you prefer)
    # allow_origin_regex=r"http://(localhost|127\.0\.0\.1):5173",
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
    # Determine best lap (exclude pit laps and null/zero times)
    best_ms = None
    for row in rows:
        lap_ms = row[1]
        is_pit = row[6]
        if not is_pit and lap_ms and lap_ms > 0:
            if best_ms is None or lap_ms < best_ms:
                best_ms = lap_ms
    result = []
    for row in rows:
        data = dict(zip(["lap","lap_ms","s1","s2","s3","compound","is_pit"], row))
        data["is_best"] = bool(best_ms is not None and not data["is_pit"] and data["lap_ms"] == best_ms)
        result.append(data)
    return result

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

@app.get("/laps/summary")
def laps_summary(session_id: int, driver_code: str):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM driver WHERE code=%s", (driver_code,))
        r = cur.fetchone()
        if not r:
            return []
        did = r[0]
        cur.execute("""
          SELECT lap_number,
                 lap_time_ms,
                 sector_1_ms,
                 sector_2_ms,
                 sector_3_ms,
                 compound,
                 is_pit
          FROM lap
          WHERE session_id=%s AND driver_id=%s
          ORDER BY lap_number
        """, (session_id, did))
        rows = cur.fetchall()

    if not rows:
        return []

    parsed = []
    for row in rows:
        parsed.append({
            "lap": row[0],
            "lap_ms": row[1],
            "s1": row[2],
            "s2": row[3],
            "s3": row[4],
            "compound": row[5],
            "is_pit": row[6],
            "is_out": False,
            "is_in": False,
        })

    # Derive simple in/out lap flags around pit laps
    for idx, row in enumerate(parsed):
        if row["is_pit"]:
            row["is_in"] = True
            if idx + 1 < len(parsed):
                parsed[idx + 1]["is_out"] = True

    def best_of(key: str) -> int | None:
        values = [p[key] for p in parsed if not p["is_pit"] and not p["is_out"] and not p["is_in"] and p[key]]
        if not values:
            return None
        return min(values)

    best_lap = best_of("lap_ms")
    best_s1 = best_of("s1")
    best_s2 = best_of("s2")
    best_s3 = best_of("s3")

    for p in parsed:
        lap_ms = p["lap_ms"] or None
        s1 = p["s1"] or None
        s2 = p["s2"] or None
        s3 = p["s3"] or None

        def delta(value: int | None, base: int | None) -> float | None:
            if value is None or base is None:
                return None
            return float(value - base)

        p["delta_ms"] = delta(lap_ms, best_lap)
        p["delta_s1"] = delta(s1, best_s1)
        p["delta_s2"] = delta(s2, best_s2)
        p["delta_s3"] = delta(s3, best_s3)
        p["has_valid"] = lap_ms is not None and lap_ms > 0 and not p["is_pit"]

    return parsed


def _fetch_lap_telemetry(conn, session_id: int, driver_id: int, lap_number: int):
    with conn.cursor() as cur:
        cur.execute(
            """
              SELECT EXTRACT(EPOCH FROM ts) AS ts,
                     speed_kph,
                     throttle_pct,
                     brake_pct,
                     x,
                     y
              FROM telemetry
              WHERE session_id=%s AND driver_id=%s AND lap_number=%s
              ORDER BY ts
            """,
            (session_id, driver_id, lap_number),
        )
        rows = cur.fetchall()
    return [
        {
            "ts": float(r[0]) if r[0] is not None else None,
            "speed": float(r[1]) if r[1] is not None else None,
            "throttle": float(r[2]) if r[2] is not None else None,
            "brake": float(r[3]) if r[3] is not None else None,
            "x": float(r[4]) if r[4] is not None else None,
            "y": float(r[5]) if r[5] is not None else None,
        }
        for r in rows
    ]


def _build_series(rows: list[dict[str, float | None]]):
    samples = [r for r in rows if r["x"] is not None and r["y"] is not None and r["ts"] is not None]
    if len(samples) < 2:
        return None

    dist = [0.0]
    time = [0.0]
    speed = [float(samples[0]["speed"] or 0.0)]
    throttle = [float(samples[0]["throttle"] or 0.0)]
    brake = [float(samples[0]["brake"] or 0.0)]
    xs = [float(samples[0]["x"])]
    ys = [float(samples[0]["y"])]

    prev_x = float(samples[0]["x"])
    prev_y = float(samples[0]["y"])
    start_ts = float(samples[0]["ts"])

    for sample in samples[1:]:
        x = float(sample["x"])
        y = float(sample["y"])
        ts = float(sample["ts"])

        segment = math.hypot(x - prev_x, y - prev_y)
        dist.append(dist[-1] + segment)
        time.append(ts - start_ts)
        speed.append(float(sample["speed"] or speed[-1]))
        throttle.append(float(sample["throttle"] or throttle[-1]))
        brake.append(float(sample["brake"] or brake[-1]))

        prev_x = x
        prev_y = y

        xs.append(x)
        ys.append(y)

    return {
        "dist": dist,
        "time": time,
        "speed": speed,
        "throttle": throttle,
        "brake": brake,
        "x": xs,
        "y": ys,
    }


def _moving_average(values: list[float], window: int = 9) -> list[float]:
    if window <= 1 or len(values) <= 2:
        return values[:]
    half = window // 2
    extended = [values[0]] * half + values + [values[-1]] * half
    result = []
    for i in range(len(values)):
        segment = extended[i:i + window]
        result.append(sum(segment) / len(segment))
    return result


def _resample_series(series: dict[str, list[float]], step: float = 5.0, grid: list[float] | None = None):
    dist = series["dist"]
    total = dist[-1]
    if grid is None:
        steps = max(int(total / step), 1)
        grid = [min(total, i * step) for i in range(steps + 1)]
        if grid[-1] != total:
            grid.append(total)

    result: dict[str, list[float]] = {"dist": list(grid)}
    fields = ["time", "speed", "throttle", "brake", "x", "y"]
    for field in fields:
        result[field] = []

    idx = 1
    for target in grid:
        while idx < len(dist) and dist[idx] < target:
            idx += 1
        if idx >= len(dist):
            for field in fields:
                result[field].append(series[field][-1])
            continue

        d0 = dist[idx - 1]
        d1 = dist[idx]
        ratio = 0.0 if d1 == d0 else (target - d0) / (d1 - d0)
        for field in fields:
            v0 = series[field][idx - 1]
            v1 = series[field][idx]
            result[field].append(v0 + ratio * (v1 - v0))

    return result


def _detect_corners(
    reference,
    compare,
    *,
    brake_on: float,
    brake_off: float,
    throttle_exit: float,
    min_distance: float,
    min_drop: float,
    min_time: float,
    min_peak_brake: float,
    scale01: bool,
):
    raw_speed = reference["speed"]
    raw_brake = reference["brake"]
    raw_throttle = reference["throttle"]

    if scale01:
        brake_on /= 100.0
        brake_off /= 100.0
        throttle_exit /= 100.0
        min_peak_brake /= 100.0

    MIN_POINTS = 3
    MERGE_GAP = 60.0

    dist = reference["dist"]
    smooth_speed = _moving_average(raw_speed, 9)
    smooth_brake = _moving_average(raw_brake, 9)
    smooth_throttle = _moving_average(raw_throttle, 9)

    segments: list[tuple[int, int]] = []
    state = "idle"
    start_idx = 0
    sustain = 0

    for idx, brk in enumerate(smooth_brake):
        if state == "idle":
            if brk >= brake_on:
                start_idx = max(0, idx - 1)
                state = "braking"
                sustain = 0
        else:
            sustain = sustain + 1 if smooth_throttle[idx] >= throttle_exit else 0
            if brk <= brake_off and sustain >= 3:
                end_idx = idx
                if end_idx - start_idx >= MIN_POINTS and dist[end_idx] - dist[start_idx] >= min_distance:
                    segments.append((start_idx, end_idx))
                state = "idle"
                sustain = 0

    # curvature fallback if no brake windows
    if not segments and reference.get("x") and reference.get("y"):
        xs = reference["x"]
        ys = reference["y"]
        if len(xs) > 2 and len(ys) > 2:
            dx = [0.0] * len(xs)
            dy = [0.0] * len(ys)
            for i in range(1, len(xs) - 1):
                dx[i] = (xs[i + 1] - xs[i - 1]) / 2.0
                dy[i] = (ys[i + 1] - ys[i - 1]) / 2.0
            dx[0] = dx[1]
            dy[0] = dy[1]
            dx[-1] = dx[-2]
            dy[-1] = dy[-2]

            ddx = [0.0] * len(xs)
            ddy = [0.0] * len(ys)
            for i in range(1, len(xs) - 1):
                ddx[i] = (dx[i + 1] - dx[i - 1]) / 2.0
                ddy[i] = (dy[i + 1] - dy[i - 1]) / 2.0

            curvature = []
            for i in range(len(xs)):
                numerator = abs(dx[i] * ddy[i] - dy[i] * ddx[i])
                denom = (dx[i] ** 2 + dy[i] ** 2) ** 1.5
                curvature.append(numerator / denom if denom else 0.0)

            if any(curvature):
                threshold = sorted(curvature)[int(len(curvature) * 0.8)]
                i = 1
                while i < len(curvature):
                    while i < len(curvature) and curvature[i] <= threshold:
                        i += 1
                    if i >= len(curvature):
                        break
                    start_idx = i
                    while i < len(curvature) and curvature[i] > threshold:
                        i += 1
                    end_idx = min(len(curvature) - 1, i)
                    if dist[end_idx] - dist[start_idx] >= min_distance:
                        segments.append((start_idx, end_idx))
                    i = end_idx + 1

    if not segments:
        segments = []

    segments.sort(key=lambda s: dist[s[0]])
    merged_segments: list[list[int]] = []
    for start_idx, end_idx in segments:
        if not merged_segments:
            merged_segments.append([start_idx, end_idx])
            continue
        prev_start, prev_end = merged_segments[-1]
        if dist[start_idx] - dist[prev_end] <= MERGE_GAP:
            merged_segments[-1][1] = max(prev_end, end_idx)
        else:
            merged_segments.append([start_idx, end_idx])

    def build_corner(start_idx: int, end_idx: int):
        distance = dist[end_idx] - dist[start_idx]
        if distance < min_distance:
            return None
        time_span = reference["time"][end_idx] - reference["time"][start_idx]
        if time_span < min_time:
            return None
        entry_speed = raw_speed[start_idx]
        exit_speed = raw_speed[end_idx]
        apex_slice = raw_speed[start_idx:end_idx + 1]
        apex_offset = apex_slice.index(min(apex_slice))
        apex_idx = start_idx + apex_offset
        apex_speed = raw_speed[apex_idx]
        speed_drop = entry_speed - apex_speed
        brake_peak = max(raw_brake[start_idx:end_idx + 1])
        if speed_drop < min_drop and brake_peak < min_peak_brake:
            return None
        throttle_exit_val = raw_throttle[end_idx]
        ref_dt = reference["time"][end_idx] - reference["time"][start_idx]
        cmp_dt = (
            compare["time"][end_idx] - compare["time"][start_idx]
            if compare is not None
            else None
        )
        return {
            "distance_start": dist[start_idx],
            "distance_end": dist[end_idx],
            "entry_speed": entry_speed,
            "apex_speed": apex_speed,
            "exit_speed": exit_speed,
            "brake_peak": brake_peak,
            "throttle_exit": throttle_exit_val,
            "delta_s": (cmp_dt - ref_dt) if cmp_dt is not None else None,
        }

    corners: list[dict[str, float]] = []
    for start_idx, end_idx in merged_segments:
        corner = build_corner(start_idx, end_idx)
        if corner:
            corners.append(corner)

    def speed_drop_fallback():
        results = []
        pre_window = 120.0
        post_window = 160.0
        for i in range(2, len(dist) - 2):
            if not (smooth_speed[i] < smooth_speed[i - 1] and smooth_speed[i] <= smooth_speed[i + 1]):
                continue
            apex_d = dist[i]
            left = i
            while left > 0 and apex_d - dist[left - 1] <= pre_window:
                left -= 1
            right = i
            while right < len(dist) - 1 and dist[right + 1] - apex_d <= post_window:
                right += 1
            entry_speed = max(smooth_speed[left:i + 1])
            exit_speed = max(smooth_speed[i:right + 1])
            apex_speed = smooth_speed[i]
            drop = max(entry_speed - apex_speed, exit_speed - apex_speed)
            if drop < min_drop:
                continue
            start_idx = i
            while start_idx > left and smooth_speed[start_idx - 1] >= smooth_speed[start_idx]:
                start_idx -= 1
            end_idx = i
            while end_idx < right and smooth_speed[end_idx + 1] >= smooth_speed[end_idx]:
                end_idx += 1
            if dist[end_idx] - dist[start_idx] < min_distance:
                continue
            results.append((start_idx, end_idx))
        return results

    if len(corners) < 12:
        extra_segments = speed_drop_fallback()
        for start_idx, end_idx in extra_segments:
            corner = build_corner(start_idx, end_idx)
            if corner:
                corners.append(corner)

    if not corners:
        return []

    corners.sort(key=lambda c: c["distance_start"])
    for idx, corner in enumerate(corners, start=1):
        corner["corner"] = idx

    def score(corner: dict[str, float]) -> float:
        return (corner["entry_speed"] - corner["apex_speed"]) + 0.5 * corner.get("brake_peak", 0.0)

    corners = sorted(corners, key=score, reverse=True)[:22]
    corners.sort(key=lambda c: c["distance_start"])
    for idx, corner in enumerate(corners, start=1):
        corner["corner"] = idx

    return corners


@app.get("/laps/corners")
def lap_corners(
    session_id: int,
    driver_code: str,
    reference_lap: int,
    compare_lap: int | None = None,
    step: float = Query(5.0, alias="step"),
    on: float = Query(3.0),
    off: float = Query(1.5),
    exit_thr: float = Query(40.0),
    min_len: float = Query(14.0),
    min_drop_kph: float = Query(9.0),
    min_time: float = Query(0.15),
    min_peak_brake: float = Query(0.5),
    scale01: bool = Query(False),
):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM driver WHERE code=%s", (driver_code,))
        r = cur.fetchone()
        if not r:
            return {"corners": [], "top_losses": []}
        did = r[0]

        ref_rows = _fetch_lap_telemetry(conn, session_id, did, reference_lap)
        cmp_rows = _fetch_lap_telemetry(conn, session_id, did, compare_lap) if compare_lap is not None else None

    ref_series = _build_series(ref_rows)
    cmp_series = _build_series(cmp_rows) if cmp_rows else None
    if not ref_series or (compare_lap is not None and not cmp_series):
        return {"corners": [], "top_losses": []}

    ref_resampled = _resample_series(ref_series, step=step)
    grid = ref_resampled["dist"]
    cmp_resampled = _resample_series(cmp_series, step=step, grid=grid) if cmp_series else None

    corners = _detect_corners(
        ref_resampled,
        cmp_resampled,
        brake_on=on,
        brake_off=off,
        throttle_exit=exit_thr,
        min_distance=min_len,
        min_drop=min_drop_kph,
        min_time=min_time,
        min_peak_brake=min_peak_brake,
        scale01=scale01,
    )

    top_losses = sorted(
        [c for c in corners if c.get("delta_s") and c["delta_s"] > 0],
        key=lambda c: c["delta_s"],
        reverse=True,
    )[:3]
    top_losses = [
        {"corner": c["corner"], "delta_s": c["delta_s"]}
        for c in top_losses
    ]

    return {"corners": corners, "top_losses": top_losses}

@app.get("/drivers")
def drivers(session_id: int):
    with db() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT d.code, d.name
            FROM lap l
            JOIN driver d ON d.id = l.driver_id
            WHERE l.session_id=%s
            ORDER BY d.code
        """, (session_id,))
        rows = cur.fetchall()
    return [dict(code=r[0], name=r[1]) for r in rows]

@app.get("/lap_summaries")
def lap_summaries(session_id: int, driver_code: str):
    with db() as conn, conn.cursor() as cur:
        # resolve driver id
        cur.execute("SELECT id FROM driver WHERE code=%s", (driver_code,))
        r = cur.fetchone()
        if not r:
            return []
        did = r[0]

        # aggregate telemetry by lap
        cur.execute("""
          SELECT lap_number,
                 COUNT(*) AS n,
                 AVG(speed_kph) AS avg_speed,
                 MAX(speed_kph) AS max_speed,
                 AVG(throttle_pct) AS avg_throttle,
                 AVG(brake_pct) AS avg_brake
          FROM telemetry
          WHERE session_id=%s AND driver_id=%s
          GROUP BY lap_number
          ORDER BY lap_number
        """, (session_id, did))
        rows = cur.fetchall()

    keys = ["lap","n","avg_speed","max_speed","avg_throttle","avg_brake"]
    return [dict(zip(keys, row)) for row in rows]
