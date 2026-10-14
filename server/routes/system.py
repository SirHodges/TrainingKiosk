"""
API routes for system-level operations.

This module provides endpoints for checking the health of the application
and initiating software updates (on Linux systems).
"""

import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from flask import Blueprint, jsonify

from server.config import BASE_DIR, get_content_dir
from server.database import get_db, get_schema_version
from server.services import question_bank

system_bp = Blueprint('system', __name__)

@system_bp.route('/health', methods=['GET'])
def health_check():
    """
    Returns basic health metrics about the system.
    Useful for monitoring to ensure the app and database are working.
    """
    try:
        with get_db() as db:
            question_count = db.execute(
                "SELECT COUNT(*) FROM questions WHERE COALESCE(status, 'active') = 'active'"
            ).fetchone()[0]
            question_total = db.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
            score_count = db.execute("SELECT COUNT(*) FROM scores").fetchone()[0]
            player_count = db.execute("SELECT COUNT(*) FROM players").fetchone()[0]
            answer_count = db.execute("SELECT COUNT(*) FROM answer_log").fetchone()[0]
            schema_version = get_schema_version(db)
            
        status = {
            'status': 'ok',
            'content_dir': str(get_content_dir()),
            'content_dir_exists': get_content_dir().exists(),
            'question_count': question_count,          # active (playable) questions
            'question_retired_count': question_total - question_count,
            'score_count': score_count,
            'player_count': player_count,
            'answer_log_count': answer_count,
            'schema_version': schema_version,
            'last_question_sync': question_bank.last_sync_summary,
            'platform': sys.platform
        }
        return jsonify(status)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@system_bp.route('/update', methods=['POST'])
def trigger_update():
    """
    Initiates a software update: triggers systemd path unit to update and reboot.
    Only works on Linux (Raspberry Pi).
    """
    if sys.platform != "linux":
        return jsonify({
            'success': False, 
            'error': 'Updates are only supported on Linux'
        }), 400
        
    try:
        update_flag = Path('/tmp/trainingkiosk_update')
        if update_flag.exists():
            try:
                update_flag.unlink()
            except OSError:
                pass
        update_flag.touch()
        
        return jsonify({
            'success': True,
            'message': 'Update initiated. The system will restart shortly.'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
