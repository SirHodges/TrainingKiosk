# TrainingKiosk V2

Welcome to TrainingKiosk V2! This application is designed to run on a Raspberry Pi as a full-screen arcade-style kiosk, offering a media player (SkillPlayer) for training videos and PDFs, and an interactive Quiz Challenge for 1-2 players.

## Features

- **SkillPlayer**: Browse and view training videos and PDFs directly on the kiosk.
- **Quiz Challenge**: 
  - 1-Player and 2-Player competitive modes.
  - Arcade-style streak multipliers and 2P "lockout" features.
  - Saves scores to a local leaderboard.
- **Gamepad Support**: Fully mapped for 8BitDo (and standard) Bluetooth controllers. Focus-based D-pad navigation means the UI can be controlled entirely without a mouse.
- **Modern UI**: Full 1920x1080 kiosk interface featuring sleek glassmorphism, animations, and arcade-themed styling.

## Installation (Raspberry Pi)

You do **not** need to manually configure the Raspberry Pi! We have provided an automated script that sets up everything (Python virtual environment, package dependencies, systemd services, and Chromium kiosk mode).

1. Clone or copy this repository to your Raspberry Pi, for example to `/home/pi/trainingkiosk`.
2. Open a terminal and navigate to the directory:
   ```bash
   cd /home/pi/trainingkiosk
   ```
3. Run the setup script:
   ```bash
   bash scripts/setup_pi.sh
   ```
4. The Raspberry Pi will automatically reboot. The kiosk app will now start automatically in full-screen mode on boot.

## Migrating from V1

If you have old data (questions, scores, views) from your V1 application, you can easily migrate them to the new V2 SQLite database.

1. Ensure the `data` directory exists.
2. Run the migration script, pointing it to your old SkillPlayer directory:
   ```bash
   # Linux / Mac
   python scripts/migrate_v1.py --source /path/to/old/SkillPlayer

   # Windows
   python scripts\migrate_v1.py --source "C:\path\to\old\SkillPlayer"
   ```
This will import your questions, scores, and views into the new database located at `data/trainingkiosk.db`.

## Adding Content

The application automatically scans for media content. By default, it looks in the `./content` folder. On the Raspberry Pi, it will prioritize USB drives mounted at `/media/pi/TRAININGKIOSK/content`.

Structure your content as follows:
```
content/
└── Categories/
    └── Skill Name/
        ├── Skill Name.jpg      <-- This image is automatically used as the logo!
        ├── Training Video.mp4
        └── Manual.pdf
```

## Updates

To update the software via GitHub in the future:
1. Use the **admin panel** in the bottom left corner of the UI (the gear icon) and click **Update & Reboot**.
2. Or, run the update script manually via terminal:
   ```bash
   bash scripts/update.sh
   ```

## Development (Windows / Local)

1. Ensure Python 3 is installed.
2. Create a virtual environment and install requirements:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   python server/app.py
   ```
4. A browser window will automatically open to `http://localhost:5000`.

## Tech Stack

- **Backend**: Python 3, Flask, Waitress (Production Server), SQLite3.
- **Gamepad Handling**: `evdev` (Linux only), bridged to frontend via Flask-SocketIO.
- **Frontend**: Vanilla HTML/CSS/JS (ES Modules). No build tools required!
