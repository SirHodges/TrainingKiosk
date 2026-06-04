"""
API routes for handling media requests.

This module provides the web endpoints that the frontend calls to
get the lists of categories, skills, and files, as well as to
actually serve the video and PDF files to the browser.
It also handles tracking how many times a file has been viewed.
"""

import mimetypes
from flask import Blueprint, jsonify, send_from_directory, request

from server.config import get_content_dir
from server.database import get_db
from server.services.media_scanner import scan_categories, scan_skills, scan_files

# Create a Blueprint, which is like a mini-app that groups related routes together
media_bp = Blueprint('media', __name__)

@media_bp.route('/categories', methods=['GET'])
def get_categories():
    """Returns a list of all available categories."""
    categories = scan_categories(get_content_dir())
    return jsonify(categories)

@media_bp.route('/<category>/skills', methods=['GET'])
def get_skills(category):
    """Returns a list of all skills within a specific category."""
    skills = scan_skills(get_content_dir(), category)
    return jsonify(skills)

@media_bp.route('/<category>/<skill>/files', methods=['GET'])
def get_files(category, skill):
    """Returns a list of all playable files within a specific skill."""
    files = scan_files(get_content_dir(), category, skill)
    return jsonify(files)

@media_bp.route('/file/<category>/<skill>/<filename>', methods=['GET'])
def serve_file(category, skill, filename):
    """
    Serves the actual media file (video or PDF) to the browser.
    Flask handles sending the correct MIME type so the browser knows how to play it.
    """
    directory = get_content_dir() / category / skill
    
    # Try to guess the correct mime type, though Flask usually handles this well
    mimetype, _ = mimetypes.guess_type(filename)
    
    # send_from_directory is secure because it prevents directory traversal attacks
    return send_from_directory(str(directory), filename, mimetype=mimetype)

@media_bp.route('/views/increment', methods=['POST'])
def increment_view():
    """
    Increments the view count for a specific file.
    Called by the frontend whenever a user starts watching a video or reading a PDF.
    Expects a JSON payload: { "category": "...", "skill": "...", "filename": "..." }
    """
    data = request.json
    if not data or not all(k in data for k in ('category', 'skill', 'filename')):
        return jsonify({'error': 'Missing required fields'}), 400
        
    category = data['category']
    skill = data['skill']
    filename = data['filename']
    
    with get_db() as db:
        # First try to find if we already have a record for this file
        row = db.execute('''
            SELECT id, count FROM views 
            WHERE category = ? AND skill = ? AND filename = ?
        ''', (category, skill, filename)).fetchone()
        
        if row:
            # Update existing record
            new_count = row['count'] + 1
            db.execute('UPDATE views SET count = ? WHERE id = ?', (new_count, row['id']))
        else:
            # Create new record
            new_count = 1
            db.execute('''
                INSERT INTO views (category, skill, filename, count) 
                VALUES (?, ?, ?, ?)
            ''', (category, skill, filename, new_count))
            
        # Get the total overall views across all files
        total_views = db.execute('SELECT SUM(count) as total FROM views').fetchone()['total']
        
        db.commit()
        
    return jsonify({
        'success': True,
        'count': new_count,
        'total': total_views or 0
    })

@media_bp.route('/views/total', methods=['GET'])
def get_total_views():
    """Returns the total number of views across all media files."""
    with get_db() as db:
        total = db.execute('SELECT SUM(count) as total FROM views').fetchone()['total']
        
    return jsonify({'total': total or 0})
