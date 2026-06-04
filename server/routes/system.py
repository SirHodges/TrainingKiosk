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

from server.config import BASE_DIR, CONTENT_DIR
from server.database import get_db

system_bp = Blueprint('system', __name__)

@system_bp.route('/health', methods=['GET'])
def health_check():
    """
    Returns basic health metrics about the system.
    Useful for monitoring to ensure the app and database are working.
    """
    try:
        with get_db() as db:
            question_count = db.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
            score_count = db.execute("SELECT COUNT(*) FROM scores").fetchone()[0]
            
        status = {
            'status': 'ok',
            'content_dir': str(CONTENT_DIR),
            'content_dir_exists': CONTENT_DIR.exists(),
            'question_count': question_count,
            'score_count': score_count,
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
