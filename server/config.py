"""
Configuration settings for the TrainingKiosk application.

This module defines all the settings and constants used throughout the app.
It also intelligently figures out where the application is running from
and where the content files (videos, PDFs) are stored.
"""

import os
import sys
from pathlib import Path

# Determine the base directory of the application
# This handles the case where the app is frozen into a single executable using PyInstaller
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

# Set up paths to important directories and files
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "trainingkiosk.db"
QUESTIONS_FILE = DATA_DIR / "questions.json"

# Resolve the content directory where videos and PDFs are stored
def get_content_dir() -> Path:
    env_path = os.environ.get("TRAININGKIOSK_CONTENT_PATH")
    usb_path = None
    if sys.platform == "linux":
        import glob
        potential_paths = glob.glob("/media/paramedictraining/*/content")
        if not potential_paths:
            potential_paths = glob.glob("/media/pi/*/content")
        if potential_paths:
            usb_path = Path(potential_paths[0])

    if env_path and Path(env_path).exists():
        return Path(env_path)
    elif usb_path and usb_path.exists():
        return usb_path
    else:
        return BASE_DIR / "content"

# Game and application constants
MAX_SCORES = 10                  # Maximum number of high scores to show on the leaderboard
SCORE_EXPIRY_DAYS = 14           # Days until a high score drops off the leaderboard
NEW_CONTENT_DAYS = 14            # Days a newly added file keeps the "NEW" badge
DEAL_SIZE = 25                   # Number of questions in a single quiz session
SUPPORTED_EXTENSIONS = {         # File types the system recognizes as valid content
    '.mp4', '.mkv', '.avi', '.mov', '.pdf'
}

# The main categories shown on the home screen
CATEGORIES = ['Skills', 'Equipment', 'Other']
