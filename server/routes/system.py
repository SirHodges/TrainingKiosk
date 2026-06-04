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

def _run_update_and_reboot():
    """
    Background thread that runs git pull, pip install, then reboots.
    Runs in a separate thread so the HTTP response can return first.
    """
    try:
        project_dir = str(BASE_DIR)
        pip_path = os.path.join(project_dir, 'venv', 'bin', 'pip')
        
        # Git fetch and reset
        subprocess.run(['git', 'fetch', 'origin'], cwd=project_dir, timeout=60)
        subprocess.run(['git', 'reset', '--hard', 'origin/main'], cwd=project_dir, timeout=30)
        
        # Install deps using venv pip directly
        subprocess.run([pip_path, 'install', '-r', 'requirements.txt'], cwd=project_dir, timeout=120)
        
        # Small delay to let things settle
        time.sleep(2)
        
        # Reboot using os.system which directly invokes the shell
        os.system('sudo /sbin/reboot -f')
        
    except Exception as e:
        print(f"Update error: {e}")

@system_bp.route('/update', methods=['POST'])
def trigger_update():
    """
    Initiates a software update: git pull, pip install, then reboot.
    Only works on Linux (Raspberry Pi).
    """
    if sys.platform != "linux":
        return jsonify({
            'success': False, 
            'error': 'Updates are only supported on Linux'
        }), 400
        
    try:
        # Run update in a background thread so we can return the response immediately
        thread = threading.Thread(target=_run_update_and_reboot, daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Update initiated. The system will restart shortly.'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
