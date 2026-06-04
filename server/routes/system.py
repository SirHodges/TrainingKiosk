"""
API routes for system-level operations.

This module provides endpoints for checking the health of the application
and initiating software updates (on Linux systems).
"""

import subprocess
import sys
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
    Initiates a software update by running the bash script.
    Only works on Linux (Raspberry Pi).
    The script handles git pull, pip installs, and service restart.
    """
    if sys.platform != "linux":
        return jsonify({
            'success': False, 
            'error': 'Updates are only supported on Linux'
        }), 400
        
    update_script = BASE_DIR / "scripts" / "update.sh"
    
    if not update_script.exists():
        return jsonify({
            'success': False, 
            'error': 'Update script not found'
        }), 404
        
    try:
        # We start the script detached so it can restart the service that is running THIS app
        subprocess.Popen(['bash', str(update_script)])
        
        return jsonify({
            'success': True,
            'message': 'Update initiated. The system will restart shortly.'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
