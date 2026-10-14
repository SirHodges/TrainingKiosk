"""
API routes for the Quiz feature.

This module provides the web endpoints that the frontend calls to
start a quiz game, submit answers, and skip questions.

Every answer and skip is written to answer_log with enough detail for
research: question version, which player slot, the OASIS number (if the
player entered one), the actual answer text picked, and the order the
answers were shown in.
"""

import json

from flask import Blueprint, jsonify, request

from server.database import get_db, clean_oasis, touch_player
from server.services import quiz_engine

quiz_bp = Blueprint('quiz', __name__)

GAME_MODULE = 'quiz_challenge'


def _player_slot(data):
    """Player slot from the request (1 or 2). Defaults to 1."""
    try:
        slot = int(data.get('player') or 1)
    except (TypeError, ValueError):
        slot = 1
    return slot if slot in (1, 2) else 1


@quiz_bp.route('/start', methods=['POST'])
def start_quiz():
    """
    Starts a new quiz session.
    Creates a hand of questions and returns them (hiding the correct answers).

    Optional JSON body (the current frontend sends nothing, which is fine):
        { "player_count": 2,
          "players": [{"slot": 1, "oasis": "12345"}, {"slot": 2, "oasis": null}] }
    """
    data = request.get_json(silent=True) or {}

    with get_db() as db:
        session = quiz_engine.create_session(db)

        if not session:
            return jsonify({'success': False, 'error': 'No questions available. Please check database.'}), 404

        try:
            player_count = int(data.get('player_count') or 1)
        except (TypeError, ValueError):
            player_count = 1

        for p in data.get('players') or []:
            if not isinstance(p, dict):
                continue
            slot = _player_slot({'player': p.get('slot')})
            oasis = clean_oasis(p.get('oasis'))
            session.players[slot] = oasis
            if oasis:
                touch_player(db, oasis)

        db.execute('''
            INSERT INTO game_sessions (session_id, game_module, player_count, settings, question_ids)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            session.session_id, GAME_MODULE, max(player_count, len(session.players), 1),
            json.dumps({'deal_size': len(session.questions)}),
            json.dumps([q['id'] for q in session.questions]),
        ))
        for slot, oasis in session.players.items():
            db.execute('INSERT OR REPLACE INTO session_players VALUES (?, ?, ?)',
                       (session.session_id, slot, oasis))
        db.commit()

    # We must strip out the correct_index before sending to the client
    # to prevent cheating (server-side validation).
    client_questions = []
    for q in session.questions:
        client_questions.append({
            'id': q['id'],
            'question': q['question'],
            'answers': q['answers'],
            'media': q.get('media'),  # image info, if any (frontend can ignore it)
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
    Expects: { "session_id", "question_index", "answer_index", "time_ms", "player"(optional) }
    """
    data = request.get_json(silent=True)
    if not data or not all(k in data for k in ('session_id', 'question_index', 'answer_index')):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400

    session_id = data['session_id']
    question_index = data['question_index']
    answer_index = data['answer_index']
    time_ms = data.get('time_ms', 0)
    slot = _player_slot(data)

    # 1. Ask the engine to check the answer
    result = quiz_engine.check_answer(session_id, question_index, answer_index)

    if not result['success']:
        return jsonify(result), 400

    # 2. Get session details to log it
    session = quiz_engine.get_session(session_id)
    q = session.questions[question_index]
    is_correct = result['correct']
    streak = session.stats['streak']

    answer_text = None
    source_index = None
    if isinstance(answer_index, int) and 0 <= answer_index < len(q['answers']):
        answer_text = q['answers'][answer_index]
        order = q.get('presented_order')
        if order:
            source_index = order[answer_index]

    # 3. Log the answer to the database for analytics
    with get_db() as db:
        db.execute('''
            INSERT INTO answer_log
            (question_id, question_version, answer_selected, answer_text, answer_source_index,
             presented_order, correct, time_to_answer_ms, streak_count, session_id,
             game_module, player_slot, player_oasis)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            q['id'], q.get('version'), answer_index, answer_text, source_index,
            json.dumps(q.get('presented_order')), is_correct, time_ms, streak, session_id,
            GAME_MODULE, slot, session.players.get(slot),
        ))
        db.commit()

    return jsonify(result)


@quiz_bp.route('/skip', methods=['POST'])
def skip_question():
    """
    Logs that a user skipped a question without answering.
    Expects: { "session_id", "question_index", "time_ms", "player"(optional) }
    """
    data = request.get_json(silent=True)
    if not data or not all(k in data for k in ('session_id', 'question_index')):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400

    session_id = data['session_id']
    question_index = data['question_index']
    time_ms = data.get('time_ms', 0)
    slot = _player_slot(data)

    session = quiz_engine.get_session(session_id)
    if not session:
        return jsonify({'success': False, 'error': 'Invalid session'}), 400
    if not isinstance(question_index, int) or not 0 <= question_index < len(session.questions):
        return jsonify({'success': False, 'error': 'Invalid question index'}), 400

    # Update session stats
    session.stats['skipped'] += 1
    session.stats['streak'] = 0  # Skipping breaks the streak

    # Advance the question index if needed
    if question_index >= session.current_index:
        session.current_index = question_index + 1

    q = session.questions[question_index]

    with get_db() as db:
        db.execute('''
            INSERT INTO answer_log
            (question_id, question_version, presented_order, skipped, time_to_answer_ms,
             session_id, game_module, player_slot, player_oasis)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
        ''', (
            q['id'], q.get('version'), json.dumps(q.get('presented_order')), time_ms,
            session_id, GAME_MODULE, slot, session.players.get(slot),
        ))
        db.commit()

    return jsonify({
        'success': True,
        'score': session.score
    })
