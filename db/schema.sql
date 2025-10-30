CREATE TABLE IF NOT EXISTS driver (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id SERIAL PRIMARY KEY,
    season INTEGER NOT NULL,
    round INTEGER NOT NULL,
    session_type TEXT NOT NULL, -- 'FP', 'Q', 'R'
    circuit TEXT
);

CREATE TABLE IF NOT EXISTS lap(
    id BIGSERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES session(id),
    driver_id INT NOT NULL REFERENCES driver(id),
    lap_number INT NOT NULL,
    lap_time_ms INT,
    sector_1_ms INT,
    sector_2_ms INT,
    sector_3_ms INT,
    compound TEXT,
    is_pit BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS lap_idx ON lap(session_id, driver_id, lap_number);

CREATE TABLE IF NOT EXISTS telemetry(
    ts TIMESTAMPTZ NOT NULL,
    session_id INT NOT NULL REFERENCES session(id),
    driver_id INT NOT NULL REFERENCES driver(id),
    lap_number INT,
    speed_kph REAL,
    throttle_pct REAL,
    brake_pct REAL,
    gear INT,
    rpm INT,
    x REAL,
    y REAL,
    lat REAL,
    lon REAL
);

SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS telemetry_idx ON telemetry(session_id, driver_id, lap_number, ts);
