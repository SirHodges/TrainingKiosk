"""
API routes for the Leaderboard feature.

This module provides endpoints for saving high scores, retrieving
the top scores list, and checking if a score qualifies.
It automatically ignores scores older than SCORE_EXPIRY_DAYS.
"""

import json
from flask import Blueprint, jsonify, request

from server.config import MAX_SCORES, SCORE_EXPIRY_DAYS
from server.database import get_db

leaderboard_bp = Blueprint('leaderboard', __name__)

def get_top_scores(db):
    """
    Helper function to query the top recent scores from the database.
    """
    # SQLite uses modifiers like '-14 days' with the datetime function
    expiry_modifier = f"-{SCORE_EXPIRY_DAYS} days"
    
    # Fetch top MAX_SCORES that were created within the expiration window
    rows = db.execute(f'''
        SELECT id, name, score, stats, created_at 
        FROM scores 
        WHERE created_at >= datetime('now', ?)
        ORDER BY score DESC, created_at DESC
        LIMIT ?
    ''', (expiry_modifier, MAX_SCORES)).fetchall()
    
    scores = []
    for rank, row in enumerate(rows, start=1):
        scores.append({
            'rank': rank,
            'id': row['id'],
            'name': row['name'],
            'score': row['score'],
            'stats': json.loads(row['stats']) if row['stats'] else {},
            'date': row['created_at']
        })
        
    return scores

@leaderboard_bp.route('/', methods=['GET'])
def get_leaderboard():
    """Returns the current list of high scores."""
    with get_db() as db:
        scores = get_top_scores(db)
        
    return jsonify(scores)

@leaderboard_bp.route('/check', methods=['POST'])
def check_score():
    """
    Checks if a given score is high enough to make it onto the leaderboard.
    Used by the frontend to decide whether to show the "Enter Name" screen.
    Expects: { "score": 150 }
    """
    data = request.json
    if not data or 'score' not in data:
        return jsonify({'success': False, 'error': 'Missing score'}), 400
        
    candidate_score = int(data['score'])
    
    # A score of 0 never qualifies
    if candidate_score <= 0:
        return jsonify({'success': True, 'is_top_score': False})
        
    with get_db() as db:
        scores = get_top_scores(db)
        
    # If the board isn't full yet, any positive score qualifies
    if len(scores) < MAX_SCORES:
        is_top = True
    else:
        # Otherwise, the score must be strictly greater than the lowest score on the board
        lowest_qualifying_score = scores[-1]['score']
        is_top = candidate_score > lowest_qualifying_score
        
    return jsonify({
        'success': True,
        'is_top_score': is_top
    })

@leaderboard_bp.route('/score', methods=['POST'])
def add_score():
    """
    Saves a new high score to the database.
    Expects: { "name": "AAA", "score": 150, "stats": {...} }
    """
    data = request.json
    if not data or not all(k in data for k in ('name', 'score')):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
    name = data['name'].strip()[:10].upper()  # Standard 10-letter arcade name
    score = int(data['score'])
    stats = json.dumps(data.get('stats', {}))
    
    with get_db() as db:
        # Save the new score
        db.execute('''
            INSERT INTO scores (name, score, stats)
            VALUES (?, ?, ?)
        ''', (name, score, stats))
        db.commit()
        
        # Fetch the updated leaderboard to return back
        scores = get_top_scores(db)
        
    # Check if the newly added score actually made it onto the returned leaderboard list
    is_top_score = any(s['name'] == name and s['score'] == score for s in scores)
        
    return jsonify({
        'success': True,
        'is_top_score': is_top_score,
        'scores': scores
    })

@leaderboard_bp.route('/nuke', methods=['POST'])
def clear_leaderboard():
    """
    Admin function to completely clear the leaderboard.
    Warning: This deletes all records in the scores table!
    """
    with get_db() as db:
        db.execute('DELETE FROM scores')
        db.commit()
        
    return jsonify({
        'success': True,
        'scores': []
    })
