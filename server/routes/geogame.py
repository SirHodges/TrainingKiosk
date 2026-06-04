from flask import Blueprint, jsonify, request
from server.database import get_db

geogame_bp = Blueprint('geogame', __name__)

@geogame_bp.route('/locations', methods=['GET'])
def get_locations():
    """
    Fetch a set of random active locations for the game round.
    """
    with get_db() as db:
        # Fetch up to 10 random active locations
        rows = db.execute('''
            SELECT id, location_name, lat, lon, point_value, category, zone, hint
            FROM geogame_locations
            WHERE active = TRUE
            ORDER BY RANDOM()
            LIMIT 10
        ''').fetchall()
        
        locations = [dict(row) for row in rows]
        
    return jsonify({
        "status": "success",
        "locations": locations
    })

@geogame_bp.route('/locations/all', methods=['GET'])
def get_all_locations():
    """
    Fetch ALL locations for calibration mode, ordered by name.
    """
    with get_db() as db:
        rows = db.execute('''
            SELECT id, location_name, lat, lon, point_value, category, zone, hint, active
            FROM geogame_locations
            ORDER BY location_name ASC
        ''').fetchall()
        
        locations = [dict(row) for row in rows]
        
    return jsonify({
        "status": "success",
        "locations": locations
    })

@geogame_bp.route('/locations/update', methods=['POST'])
def update_location():
    """
    Update the latitude and longitude of a specific location.
    """
    data = request.json
    if not data or 'id' not in data or 'lat' not in data or 'lon' not in data:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400
        
    loc_id = data['id']
    lat = data['lat']
    lon = data['lon']
    
    with get_db() as db:
        db.execute('''
            UPDATE geogame_locations
            SET lat = ?, lon = ?
            WHERE id = ?
        ''', (lat, lon, loc_id))
        db.commit()
        
    return jsonify({"status": "success"})


@geogame_bp.route('/score', methods=['POST'])
def save_score():
    """
    Save round performance to geogame_history.
    """
    data = request.json
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400
        
    location_name = data.get('location_name')
    winner = data.get('winner')
    points_awarded = data.get('points_awarded', 0)
    zoom_level = data.get('zoom_level', 0)
    
    with get_db() as db:
        db.execute('''
            INSERT INTO geogame_history (location_name, winner, points_awarded, zoom_level)
            VALUES (?, ?, ?, ?)
        ''', (location_name, winner, points_awarded, zoom_level))
        db.commit()
        
    return jsonify({"status": "success"})
