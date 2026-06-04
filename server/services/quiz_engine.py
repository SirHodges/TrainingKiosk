"""
Core game logic for the Quiz feature.

This module handles creating quiz sessions, shuffling questions,
and checking answers. It keeps track of a "deck" of questions to
ensure players see a good variety before questions repeat.
"""

import json
import random
import uuid
import time
from typing import Dict, Any, List, Optional

from server.config import DEAL_SIZE

# Global state to keep track of active quiz sessions and the question deck
# In a distributed production app we'd use Redis, but for a single Kiosk, memory is fine.
active_sessions: Dict[str, 'QuizSession'] = {}
quiz_deck: List[dict] = []

class QuizSession:
    """
    Represents a single play-through of the quiz game.
    Keeps track of the current question, the player's score, and statistics.
    """
    def __init__(self, session_id: str, questions: List[dict]):
        self.session_id = session_id
        self.questions = questions  # The subset of questions dealt for this game
        self.current_index = 0      # Which question the player is currently on
        self.score = 0              # Player's current score
        self.stats = {
            'correct': 0,
            'incorrect': 0,
            'skipped': 0,
            'total_time_ms': 0,
            'streak': 0,
            'max_streak': 0,
            'start_time': time.time()
        }

def _rebuild_deck(db_conn) -> None:
    """
    Fetches all questions from the database, shuffles them, and populates the deck.
    Called when the deck runs out of questions.
    """
    global quiz_deck
    
    rows = db_conn.execute("SELECT id, question, answers, correct FROM questions").fetchall()
    
    deck = []
    for row in rows:
        deck.append({
            'id': row['id'],
            'question': row['question'],
            'answers': json.loads(row['answers']),
            'correct': row['correct']
        })
        
    random.shuffle(deck)
    quiz_deck = deck

def create_session(db_conn) -> Optional[QuizSession]:
    """
    Creates a new quiz session, dealing a hand of questions from the deck.
    
    Args:
        db_conn: A connection to the SQLite database
        
    Returns:
        A new QuizSession instance, or None if there are no questions available.
    """
    global quiz_deck
    
    # Check if we need to rebuild the deck
    if len(quiz_deck) < DEAL_SIZE:
        _rebuild_deck(db_conn)
        
    # If there are still no questions (e.g. database is empty), return None
    if not quiz_deck:
        return None
        
    # Deal questions from the top of the deck
    deal_amount = min(DEAL_SIZE, len(quiz_deck))
    dealt_questions = []
    
    for _ in range(deal_amount):
        # Pop removes the question from the deck, ensuring it won't be seen again
        # until the deck is rebuilt.
        q = quiz_deck.pop()
        
        # We need to securely determine the correct answer index without exposing
        # the exact string matching logic to the client.
        
        # Create a copy of the answers list to shuffle
        shuffled_answers = q['answers'].copy()
        
        # Ensure the correct answer is in the list
        if q['correct'] not in shuffled_answers:
            shuffled_answers.append(q['correct'])
            
        random.shuffle(shuffled_answers)
        
        # Find where the correct answer ended up after shuffling
        correct_index = shuffled_answers.index(q['correct'])
        
        dealt_questions.append({
            'id': q['id'],
            'question': q['question'],
            'answers': shuffled_answers,
            'correct_index': correct_index  # Keep this secret from the client!
        })
        
    session_id = str(uuid.uuid4())
    session = QuizSession(session_id, dealt_questions)
    active_sessions[session_id] = session
    
    return session

def get_session(session_id: str) -> Optional[QuizSession]:
    """Retrieves an active session by its ID."""
    return active_sessions.get(session_id)

def clear_session(session_id: str) -> None:
    """Removes a session from memory when it's completed or abandoned."""
    if session_id in active_sessions:
        del active_sessions[session_id]

def check_answer(session_id: str, question_index: int, answer_index: int) -> Dict[str, Any]:
    """
    Checks if a given answer is correct and updates the player's score.
    
    Args:
        session_id: The ID of the current game session
        question_index: Which question in the dealt hand is being answered
        answer_index: Which answer the player selected (0, 1, 2, or 3)
        
    Returns:
        A dictionary containing the results of the check.
    """
    session = get_session(session_id)
    
    if not session:
        return {'success': False, 'error': 'Invalid or expired session'}
        
    if question_index < 0 or question_index >= len(session.questions):
        return {'success': False, 'error': 'Invalid question index'}
        
    question = session.questions[question_index]
    correct_idx = question['correct_index']
    
    is_correct = (answer_index == correct_idx)
    
    # Update score and statistics
    if is_correct:
        # Base points + streak bonus
        points = 10 + (session.stats['streak'] * 2)
        session.score += points
        session.stats['correct'] += 1
        session.stats['streak'] += 1
        
        if session.stats['streak'] > session.stats['max_streak']:
            session.stats['max_streak'] = session.stats['streak']
    else:
        session.stats['incorrect'] += 1
        session.stats['streak'] = 0
        
    # Update progress
    if question_index >= session.current_index:
        session.current_index = question_index + 1
        
    return {
        'success': True,
        'correct': is_correct,
        'correct_index': correct_idx,
        'score': session.score
    }
