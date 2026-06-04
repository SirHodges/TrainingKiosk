"""
Database setup and connection management.

This module handles creating and connecting to the local SQLite database,
which stores questions, high scores, view counts, and quiz statistics.
It uses SQLite because it's lightweight and built into Python.
"""

import sqlite3
import json
import hashlib
from datetime import datetime
from contextlib import contextmanager
from pathlib import Path

# Import our settings to get the database path
from server.config import DATABASE_PATH, QUESTIONS_FILE, DATA_DIR, BASE_DIR

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

def init_db():
    """
    Creates the necessary tables in the database if they don't already exist.
    """
    with get_db() as db:
        # Table to store quiz questions
        db.execute('''
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                question TEXT,
                answers TEXT, -- Stored as JSON array
                correct TEXT,
                tags TEXT,    -- Stored as JSON array
                calibration_level INTEGER DEFAULT 0,
                flags TEXT,   -- Stored as JSON object
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Table to store leaderboard high scores
        db.execute('''
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                score INTEGER,
                stats TEXT,   -- Stored as JSON object containing quiz stats
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Table to track how many times files have been viewed
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
        
        # Table to track detailed quiz answers for analytics
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
        
        # Ottawa GeoGame Tables
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
        
        db.commit()

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
    Reads the questions.json file and imports any new questions into the database.
    Uses MD5 hashes of the question text to uniquely identify them,
    preventing duplicate entries if the file is imported multiple times.
    """
    if not QUESTIONS_FILE.exists():
        print(f"No questions file found at {QUESTIONS_FILE}. Skipping import.")
        return

    try:
        with open(QUESTIONS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Some JSON files have questions directly, others might nest them under a key
        questions_list = data.get('questions', data) if isinstance(data, dict) else data
        
        if not isinstance(questions_list, list):
            print("Invalid format in questions.json")
            return
            
        with get_db() as db:
            imported_count = 0
            for q in questions_list:
                question_text = q.get('question', '').strip()
                if not question_text:
                    continue
                    
                # Generate a unique ID based on the question text (same as V1)
                q_id = hashlib.md5(question_text.encode('utf-8')).hexdigest()
                
                # Check if this question already exists
                existing = db.execute("SELECT id FROM questions WHERE id = ?", (q_id,)).fetchone()
                if not existing:
                    answers = json.dumps(q.get('answers', []))
                    correct = q.get('correct', '')
                    tags = json.dumps(q.get('tags', []))
                    
                    db.execute('''
                        INSERT INTO questions (id, question, answers, correct, tags)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (q_id, question_text, answers, correct, tags))
                    imported_count += 1
            
            db.commit()
            if imported_count > 0:
                print(f"Successfully imported {imported_count} new questions.")
                
    except Exception as e:
        print(f"Error importing questions: {e}")
