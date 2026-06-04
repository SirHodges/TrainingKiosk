#!/usr/bin/env python3
"""
Migration tool to import data from the V1 SkillPlayer app.

This script reads the old JSON files (questions.json, scores.json, views.json)
from the provided source directory and inserts them into the new SQLite database.
"""

import sys
import json
import argparse
import hashlib
from pathlib import Path

# Add project root to path so we can import our server modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from server.database import get_db, init_db

def migrate_questions(source_dir: Path):
    """Imports questions from V1."""
    q_file = source_dir / "questions.json"
    if not q_file.exists():
        print(f"Skipping questions: {q_file} not found.")
        return 0
        
    try:
        with open(q_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        questions_list = data.get('questions', data) if isinstance(data, dict) else data
        
        imported = 0
        with get_db() as db:
            for q in questions_list:
                q_text = q.get('question', '').strip()
                if not q_text:
                    continue
                    
                q_id = hashlib.md5(q_text.encode('utf-8')).hexdigest()
                
                # Check if exists
                if not db.execute("SELECT id FROM questions WHERE id = ?", (q_id,)).fetchone():
                    answers = json.dumps(q.get('answers', []))
                    correct = q.get('correct', '')
                    tags = json.dumps(q.get('tags', []))
                    
                    db.execute('''
                        INSERT INTO questions (id, question, answers, correct, tags)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (q_id, q_text, answers, correct, tags))
                    imported += 1
            db.commit()
            return imported
    except Exception as e:
        print(f"Error migrating questions: {e}")
        return 0

def migrate_scores(source_dir: Path):
    """Imports scores from V1."""
    s_file = source_dir / "scores.json"
    if not s_file.exists():
        print(f"Skipping scores: {s_file} not found.")
        return 0
        
    try:
        with open(s_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        scores_list = data.get('scores', data) if isinstance(data, dict) else data
        
        imported = 0
        with get_db() as db:
            for s in scores_list:
                name = s.get('name', 'UNK')[:3].upper()
                score = s.get('score', 0)
                # V1 date format varied, we'll just insert it as new since we want to keep them
                
                db.execute('''
                    INSERT INTO scores (name, score, stats)
                    VALUES (?, ?, '{}')
                ''', (name, score))
                imported += 1
            db.commit()
            return imported
    except Exception as e:
        print(f"Error migrating scores: {e}")
        return 0

def migrate_views(source_dir: Path):
    """Imports view counts from V1."""
    v_file = source_dir / "views.json"
    if not v_file.exists():
        print(f"Skipping views: {v_file} not found.")
        return 0
        
    try:
        with open(v_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        imported = 0
        with get_db() as db:
            for item in data:
                # V1 views often just had the filepath as key and count as value
                # e.g., {"Skills/Knots/video.mp4": 5}
                if isinstance(data, dict):
                    # Handle dictionary format
                    for path, count in data.items():
                        parts = path.split('/')
                        if len(parts) >= 3:
                            category = parts[0]
                            skill = parts[1]
                            filename = parts[-1]
                            
                            db.execute('''
                                INSERT OR IGNORE INTO views (category, skill, filename, count)
                                VALUES (?, ?, ?, ?)
                            ''', (category, skill, filename, count))
                            imported += 1
                elif isinstance(item, dict) and 'filename' in item:
                    # Handle array of objects format
                    category = item.get('category', 'Unknown')
                    skill = item.get('skill', 'Unknown')
                    filename = item.get('filename', '')
                    count = item.get('count', 0)
                    
                    if filename:
                        db.execute('''
                            INSERT OR IGNORE INTO views (category, skill, filename, count)
                            VALUES (?, ?, ?, ?)
                        ''', (category, skill, filename, count))
                        imported += 1
            db.commit()
            return imported
    except Exception as e:
        print(f"Error migrating views: {e}")
        return 0

def main():
    parser = argparse.ArgumentParser(description="Migrate data from V1 to V2 database.")
    parser.add_argument("--source", required=True, help="Path to the old V1 application directory containing json files.")
    
    args = parser.parse_args()
    source_dir = Path(args.source)
    
    if not source_dir.exists() or not source_dir.is_dir():
        print(f"Error: Source directory {source_dir} does not exist.")
        sys.exit(1)
        
    print("Initializing V2 database...")
    init_db()
    
    print("\nStarting migration...")
    
    q_count = migrate_questions(source_dir)
    print(f"Imported {q_count} questions.")
    
    s_count = migrate_scores(source_dir)
    print(f"Imported {s_count} scores.")
    
    v_count = migrate_views(source_dir)
    print(f"Imported {v_count} view records.")
    
    print("\nMigration complete!")

if __name__ == "__main__":
    main()
