"""
Database setup and connection management.

This module handles creating and connecting to the local SQLite database,
which stores questions, high scores, view counts, players and quiz statistics.
It uses SQLite because it's lightweight and built into Python.

SCHEMA VERSIONS
---------------
The database remembers which "schema version" it is on (SQLite's built-in
PRAGMA user_version). On startup, init_db() runs any upgrade steps the
database hasn't had yet, in order. Each step is safe to run twice.

    1 = original V2 tables (questions, scores, views, answer_log, geogame_*)
    2 = question versions + history, flexible tags, explanations/references,
        images, players (OASIS), game sessions, richer answer log

To change the schema in future: add a new _migrate_to_N() function and add
it to MIGRATIONS. Never edit an old migration once it has shipped.
"""

import sqlite3
import json
import shutil
from datetime import datetime
from contextlib import contextmanager

# Import our settings to get the database path
from server.config import DATABASE_PATH, DATA_DIR, BASE_DIR

SCHEMA_VERSION = 2


def get_db_connection():
    """
    Creates a new connection to the SQLite database.
    Returns the connection object.
    """
    # Ensure the data directory exists before creating the database file
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DATABASE_PATH)
    # This allows us to access columns by name (like a dictionary)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    """
    A context manager for database connections.
    Usage:
        with get_db() as db:
            db.execute(...)
    This automatically closes the connection when done.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Small helpers used by the migrations
# ---------------------------------------------------------------------------

def _column_exists(db, table, column):
    rows = db.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r['name'] == column for r in rows)


def _add_column(db, table, column, definition):
    """Adds a column only if it isn't already there (so re-running is safe)."""
    if not _column_exists(db, table, column):
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _backup_database(label):
    """Copies the database file before an upgrade, so nothing can be lost."""
    if not DATABASE_PATH.exists():
        return None
    backup_dir = DATA_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = backup_dir / f"trainingkiosk-{label}-{stamp}.db"
    shutil.copy2(DATABASE_PATH, dest)
    return dest


# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------

def _migrate_to_1(db):
    """The original V2 tables."""
    db.execute('''
        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            question TEXT,
            answers TEXT, -- Stored as JSON array
            correct TEXT,
            tags TEXT,    -- Stored as JSON
            calibration_level INTEGER DEFAULT 0,
            flags TEXT,   -- Stored as JSON object
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            score INTEGER,
            stats TEXT,   -- Stored as JSON object containing quiz stats
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            skill TEXT,
            filename TEXT,
            count INTEGER DEFAULT 0,
            UNIQUE(category, skill, filename)
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS answer_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id TEXT,
            answer_selected INTEGER,
            correct BOOLEAN,
            time_to_answer_ms INTEGER,
            skipped BOOLEAN DEFAULT FALSE,
            streak_count INTEGER DEFAULT 0,
            session_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS geogame_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_name TEXT UNIQUE,
            lat REAL,
            lon REAL,
            point_value INTEGER,
            category TEXT,
            zone TEXT,
            hint TEXT,
            active BOOLEAN DEFAULT TRUE
        )
    ''')

    db.execute('''
        CREATE TABLE IF NOT EXISTS geogame_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_name TEXT,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            winner TEXT,
            points_awarded INTEGER,
            zoom_level INTEGER,
            FOREIGN KEY(location_name) REFERENCES geogame_locations(location_name)
        )
    ''')


def _migrate_to_2(db):
    """
    Question versioning, flexible tags, players and research-grade logging.
    Existing questions keep their IDs, so their answer history stays linked.
    """
    # --- questions: new columns -------------------------------------------
    _add_column(db, 'questions', 'version', 'INTEGER DEFAULT 1')
    _add_column(db, 'questions', 'status', "TEXT DEFAULT 'active'")   # active | retired
    _add_column(db, 'questions', 'explanation', 'TEXT')               # shown after answering (future)
    _add_column(db, 'questions', 'reference', 'TEXT')                 # e.g. "BLS PCS v3.4, Cardiac Arrest"
    _add_column(db, 'questions', 'media', 'TEXT')                     # JSON, e.g. {"image": "...", "alt": "..."}
    _add_column(db, 'questions', 'extra', 'TEXT')                     # JSON, any extra fields from the file
    _add_column(db, 'questions', 'content_hash', 'TEXT')
    _add_column(db, 'questions', 'updated_at', 'TIMESTAMP')
    _add_column(db, 'questions', 'retired_at', 'TIMESTAMP')

    # --- full history of every version of every question ------------------
    db.execute('''
        CREATE TABLE IF NOT EXISTS question_versions (
            question_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            content TEXT NOT NULL,        -- JSON snapshot of the question at this version
            content_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (question_id, version)
        )
    ''')

    # --- flexible tags: any tag type, any value ---------------------------
    # e.g. ('q_123', 'topic', 'cardiac'), ('q_123', 'scope', 'pcp')
    db.execute('''
        CREATE TABLE IF NOT EXISTS question_tags (
            question_id TEXT NOT NULL,
            tag_type TEXT NOT NULL,
            tag_value TEXT NOT NULL,
            PRIMARY KEY (question_id, tag_type, tag_value)
        )
    ''')
    db.execute('CREATE INDEX IF NOT EXISTS idx_question_tags_type_value ON question_tags(tag_type, tag_value)')

    # --- players, identified by OASIS number only --------------------------
    # 'profile' is room for avatars, gear and unlocks later.
    db.execute('''
        CREATE TABLE IF NOT EXISTS players (
            oasis TEXT PRIMARY KEY,
            display_name TEXT,
            profile TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # --- one row per game played (any game module) -------------------------
    db.execute('''
        CREATE TABLE IF NOT EXISTS game_sessions (
            session_id TEXT PRIMARY KEY,
            game_module TEXT NOT NULL,    -- e.g. 'quiz_challenge'
            player_count INTEGER DEFAULT 1,
            settings TEXT DEFAULT '{}',   -- JSON (mode, filters, deal size...)
            question_ids TEXT,            -- JSON list of questions dealt
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS session_players (
            session_id TEXT NOT NULL,
            player_slot INTEGER NOT NULL, -- 1 or 2
            oasis TEXT,                   -- NULL = anonymous
            PRIMARY KEY (session_id, player_slot)
        )
    ''')

    # --- answer_log: research fields ---------------------------------------
    _add_column(db, 'answer_log', 'question_version', 'INTEGER')
    _add_column(db, 'answer_log', 'game_module', 'TEXT')
    _add_column(db, 'answer_log', 'player_slot', 'INTEGER')
    _add_column(db, 'answer_log', 'player_oasis', 'TEXT')
    _add_column(db, 'answer_log', 'answer_text', 'TEXT')            # the actual words picked
    _add_column(db, 'answer_log', 'answer_source_index', 'INTEGER') # position in the question file (before shuffling)
    _add_column(db, 'answer_log', 'presented_order', 'TEXT')        # JSON: file positions in the order shown on screen
    db.execute('CREATE INDEX IF NOT EXISTS idx_answer_log_question ON answer_log(question_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_answer_log_player ON answer_log(player_oasis)')

    # --- scores: link to player and game -----------------------------------
    _add_column(db, 'scores', 'player_oasis', 'TEXT')
    _add_column(db, 'scores', 'game_module', "TEXT DEFAULT 'quiz_challenge'")
    _add_column(db, 'scores', 'session_id', 'TEXT')

    # --- backfill existing questions into the new structure ----------------
    from server.services.question_bank import normalize_tags, content_hash, snapshot

    rows = db.execute("SELECT * FROM questions").fetchall()
    for row in rows:
        try:
            raw_tags = json.loads(row['tags']) if row['tags'] else []
        except (TypeError, ValueError):
            raw_tags = []
        tags = normalize_tags(raw_tags)
        q = {
            'question': row['question'],
            # stripped the same way the file importer does, so unchanged
            # questions don't look "edited" on the first sync
            'answers': [str(a).strip() for a in json.loads(row['answers'])] if row['answers'] else [],
            'correct': str(row['correct'] or '').strip(),
            'explanation': None,
            'reference': None,
            'media': None,
            'tags': tags,
        }
        h = content_hash(q)
        db.execute('''
            UPDATE questions
               SET tags = ?, content_hash = ?, version = COALESCE(version, 1),
                   status = COALESCE(status, 'active'), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
        ''', (json.dumps(tags), h, row['id']))
        db.execute('''
            INSERT OR IGNORE INTO question_versions (question_id, version, content, content_hash)
            VALUES (?, 1, ?, ?)
        ''', (row['id'], json.dumps(snapshot(q)), h))
        for tag_type, values in tags.items():
            for v in values:
                db.execute('INSERT OR IGNORE INTO question_tags VALUES (?, ?, ?)', (row['id'], tag_type, v))


MIGRATIONS = [
    (1, _migrate_to_1),
    (2, _migrate_to_2),
]


def get_schema_version(db):
    return db.execute("PRAGMA user_version").fetchone()[0]


def init_db():
    """
    Creates the database if needed and upgrades it to the latest schema.
    Takes a backup copy before any upgrade of an existing database.
    """
    with get_db() as db:
        current = get_schema_version(db)

        # Databases created before versioning existed report 0 but already
        # have the V1 tables. Treat them as version 1.
        if current == 0:
            has_questions = db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='questions'"
            ).fetchone()
            if has_questions:
                _migrate_to_1(db)  # harmless: only creates anything missing
                db.execute("PRAGMA user_version = 1")
                db.commit()
                current = 1

        pending = [(v, fn) for v, fn in MIGRATIONS if v > current]
        if not pending:
            return

        if current > 0:
            backup = _backup_database(f"pre-v{pending[-1][0]}")
            if backup:
                print(f"Database backed up to {backup}")

        for version, migrate in pending:
            print(f"Upgrading database to schema version {version}...")
            try:
                migrate(db)
                db.execute(f"PRAGMA user_version = {version}")
                db.commit()
            except Exception:
                db.rollback()
                raise


# ---------------------------------------------------------------------------
# Players
# ---------------------------------------------------------------------------

def clean_oasis(value):
    """
    Tidies an OASIS number typed by a player. Returns None if it's blank or
    clearly not an ID (we only allow letters and digits, up to 20 characters).
    """
    if value is None:
        return None
    s = str(value).strip()
    if not s or len(s) > 20 or not s.isalnum():
        return None
    return s.upper()


def touch_player(db, oasis):
    """Creates the player row if new, otherwise updates last_seen_at."""
    db.execute('''
        INSERT INTO players (oasis) VALUES (?)
        ON CONFLICT(oasis) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
    ''', (oasis,))


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def import_geogame_locations():
    """
    Seeds the geogame_locations table from ottawa_locations.json if available.
    """
    locations_file = BASE_DIR / "server" / "ottawa_locations.json"
    if not locations_file.exists():
        return

    try:
        with open(locations_file, 'r', encoding='utf-8') as f:
            locations = json.load(f)

        with get_db() as db:
            for loc in locations:
                db.execute('''
                    INSERT OR IGNORE INTO geogame_locations
                    (location_name, lat, lon, point_value, category, zone, hint, active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    loc.get('location_name'),
                    loc.get('lat'),
                    loc.get('lon'),
                    loc.get('point_value', 10),
                    loc.get('category', 'General'),
                    loc.get('zone', 'Central'),
                    loc.get('hint', ''),
                    loc.get('active', True)
                ))
            db.commit()
    except Exception as e:
        print(f"Error importing GeoGame locations: {e}")


def import_questions():
    """
    Kept for older scripts. Questions are now synced by
    server.services.question_bank.sync_questions().
    """
    from server.services.question_bank import sync_questions
    return sync_questions()
