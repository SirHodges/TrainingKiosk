import sys
from pathlib import Path
sys.path.insert(0, str(Path('.')))
from server.app import create_app
from server.database import get_db
from server.services import quiz_engine

app = create_app()
with app.app_context():
    with get_db() as db:
        session = quiz_engine.create_session(db)
        print("Number of questions:", len(session.questions) if session else "None")
