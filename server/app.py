"""
The main entry point for the TrainingKiosk application.

This file sets up the Flask web server, registers all the different routes (URLs),
initializes the database, and starts the optional gamepad handler on Linux.
"""

import sys
from pathlib import Path
import time
import webbrowser
import threading

# Add the project root to the system path so imports work correctly
# This avoids needing complex __init__.py package setups
sys.path.insert(0, str(Path(__file__).parent.parent))

from flask import Flask, send_from_directory
try:
    from flask_socketio import SocketIO
    HAS_SOCKETIO = True
except ImportError:
    HAS_SOCKETIO = False
    print("Warning: flask_socketio not installed. Real-time features won't work.")

# Import our settings and database tools
from server.config import BASE_DIR
from server.database import init_db, import_questions, import_geogame_locations, get_db

# Import the different sections (blueprints) of our website
from server.routes.media import media_bp
from server.routes.quiz import quiz_bp
from server.routes.leaderboard import leaderboard_bp
from server.routes.system import system_bp
from server.routes.geogame import geogame_bp

def create_app():
    """
    Application factory function. Creates and configures the Flask application.
    """
    # Point Flask to our frontend directory for templates and static files
    frontend_dir = BASE_DIR / "frontend"
    
    app = Flask(__name__, 
                template_folder=str(frontend_dir),
                static_folder=str(frontend_dir))
                
    app.config['SECRET_KEY'] = 'training-kiosk-secret-key-keep-it-safe'

    # Register all the routes from our different modules
    app.register_blueprint(media_bp, url_prefix='/api/media')
    app.register_blueprint(quiz_bp, url_prefix='/api/quiz')
    app.register_blueprint(leaderboard_bp, url_prefix='/api/leaderboard')
    app.register_blueprint(system_bp, url_prefix='/api/system')
    app.register_blueprint(geogame_bp, url_prefix='/api/geogame')

    # Add a route to serve the main HTML page
    @app.route('/')
    def index():
        return send_from_directory(app.template_folder, 'index.html')

    # Serve static assets from the frontend directory
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(app.static_folder, path)

    # Initialize the database and questions before processing the first request
    with app.app_context():
        init_db()
        # Only import if the questions table is empty to save time
        with get_db() as db:
            count = db.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
            if count == 0:
                import_questions()
            
            # Seed the geogame_locations table
            geogame_count = db.execute("SELECT COUNT(*) FROM geogame_locations").fetchone()[0]
            if geogame_count == 0:
                import_geogame_locations()

    return app

# Create the global app instance
app = create_app()

# Set up SocketIO for real-time communication (like gamepad button presses)
socketio = None
if HAS_SOCKETIO:
    socketio = SocketIO(app, cors_allowed_origins="*")

# Start the gamepad handler if we're on Linux (Raspberry Pi)
if sys.platform == "linux":
    try:
        from server.services.gamepad import GamepadHandler
        from server.services.input_bridge import setup_input_bridge
        
        gamepad_handler = GamepadHandler()
        if socketio:
            setup_input_bridge(socketio, gamepad_handler)
            print("Gamepad handler and input bridge initialized successfully.")
    except Exception as e:
        print(f"Could not initialize gamepad support: {e}")

def open_browser():
    """Wait a moment for the server to start, then open the browser."""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # When running this script directly, start the server
    port = 5000
    print(f"Starting TrainingKiosk backend on port {port}...")
    
    # We open a browser automatically for convenience
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Use Waitress for a production-ready server if available, 
    # otherwise fall back to Flask's built-in development server
    try:
        import waitress
        print("Using Waitress WSGI server.")
        if socketio:
            # Note: Waitress doesn't natively support WebSockets, so SocketIO will use long-polling
            # For true WebSockets in production, eventlet or gevent would be better.
            # socketio.run defaults to Werkzeug dev server if eventlet/gevent aren't found.
            socketio.run(app, host='0.0.0.0', port=port, use_reloader=False, allow_unsafe_werkzeug=True)
        else:
            waitress.serve(app, host='0.0.0.0', port=port)
    except ImportError:
        print("Waitress not found, using Flask development server.")
        if socketio:
            socketio.run(app, host='0.0.0.0', port=port, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
        else:
            app.run(host='0.0.0.0', port=port, debug=False)
