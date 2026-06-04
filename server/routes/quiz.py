"""
API routes for the Quiz feature.

This module provides the web endpoints that the frontend calls to
start a quiz game, submit answers, and skip questions.
"""

from flask import Blueprint, jsonify, request

from server.database import get_db
from server.services import quiz_engine

quiz_bp = Blueprint('quiz', __name__)

@quiz_bp.route('/start', methods=['POST'])
def start_quiz():
    """
    Starts a new quiz session.
    Creates a hand of questions and returns them (hiding the correct answers).
    """
    with get_db() as db:
        session = quiz_engine.create_session(db)
        
    if not session:
        return jsonify({'success': False, 'error': 'No questions available. Please check database.'}), 404
        
    # We must strip out the correct_index before sending to the client
    # to prevent cheating (server-side validation).
    client_questions = []
    for q in session.questions:
        client_questions.append({
            'id': q['id'],
            'question': q['question'],
            'answers': q['answers']
        })
        
    return jsonify({
        'success': True,
        'session_id': session.session_id,
        'questions': client_questions,
        'total': len(client_questions)
    })

@quiz_bp.route('/answer', methods=['POST'])
def submit_answer():
    """
    Receives an answer from the user, checks if it's correct,
    logs the event to the database, and returns the result.
    Expects: { "session_id", "question_index", "answer_index", "time_ms" }
    """
    data = request.json
    if not data or not all(k in data for k in ('session_id', 'question_index', 'answer_index')):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
    session_id = data['session_id']
    question_index = data['question_index']
    answer_index = data['answer_index']
    time_ms = data.get('time_ms', 0)
    
    # 1. Ask the engine to check the answer
    result = quiz_engine.check_answer(session_id, question_index, answer_index)
    
    if not result['success']:
        return jsonify(result), 400
        
    # 2. Get session details to log it
    session = quiz_engine.get_session(session_id)
    question_id = session.questions[question_index]['id']
    is_correct = result['correct']
    streak = session.stats['streak']
    
    # 3. Log the answer to the database for analytics
    with get_db() as db:
        db.execute('''
            INSERT INTO answer_log 
            (question_id, answer_selected, correct, time_to_answer_ms, streak_count, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (question_id, answer_index, is_correct, time_ms, streak, session_id))
        db.commit()
        
    return jsonify(result)

@quiz_bp.route('/skip', methods=['POST'])
def skip_question():
    """
    Logs that a user skipped a question without answering.
    Expects: { "session_id", "question_index", "time_ms" }
    """
    data = request.json
    if not data or not all(k in data for k in ('session_id', 'question_index')):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
    session_id = data['session_id']
    question_index = data['question_index']
    time_ms = data.get('time_ms', 0)
    
    session = quiz_engine.get_session(session_id)
    if not session:
        return jsonify({'success': False, 'error': 'Invalid session'}), 400
        
    # Update session stats
    session.stats['skipped'] += 1
    session.stats['streak'] = 0  # Skipping breaks the streak
    
    # Advance the question index if needed
    if question_index >= session.current_index:
        session.current_index = question_index + 1
        
    question_id = session.questions[question_index]['id']
    
    with get_db() as db:
        db.execute('''
            INSERT INTO answer_log 
            (question_id, skipped, time_to_answer_ms, session_id)
            VALUES (?, 1, ?, ?)
        ''', (question_id, time_ms, session_id))
        db.commit()
        
    return jsonify({
        'success': True,
        'score': session.score
    })
