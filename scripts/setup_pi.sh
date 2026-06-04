#!/bin/bash
# TrainingKiosk Raspberry Pi Setup Script
# This script installs all necessary software, sets up the Python environment,
# and configures the app to run automatically on boot.

set -e

echo "Starting TrainingKiosk Setup..."

# Get the directory where this script is located, then go up one level to the project root
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
echo "Project directory is: $PROJECT_DIR"

# 1. Update system and install prerequisites
echo "Installing system packages..."
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip chromium git

# 2. Set up Python Virtual Environment
echo "Setting up Python virtual environment..."
cd "$PROJECT_DIR"
python3 -m venv venv
source venv/bin/activate

# 3. Install Python dependencies
echo "Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

# evdev requires specific headers sometimes, but usually pip handles it
pip install evdev

# 4. Create the systemd service for the backend server
echo "Creating systemd service for the Flask backend..."
SERVICE_FILE="/tmp/trainingkiosk.service"

cat << EOF > $SERVICE_FILE
[Unit]
Description=TrainingKiosk Backend Server
After=network.target

[Service]
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
Environment="TRAININGKIOSK_CONTENT_PATH=/media/pi/TRAININGKIOSK/content"
ExecStart=$PROJECT_DIR/venv/bin/python $PROJECT_DIR/server/app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo mv $SERVICE_FILE /etc/systemd/system/trainingkiosk.service
sudo systemctl daemon-reload
sudo systemctl enable trainingkiosk.service

# 4.5. Create the systemd updater path and service
echo "Creating systemd units for the updater..."

# Ensure the update script is executable
chmod +x "$PROJECT_DIR/scripts/update.sh"

UPDATER_SERVICE_FILE="/tmp/trainingkiosk-updater.service"
UPDATER_PATH_FILE="/tmp/trainingkiosk-updater.path"

cat << EOF > $UPDATER_SERVICE_FILE
[Unit]
Description=TrainingKiosk Updater Service

[Service]
Type=oneshot
ExecStart=$PROJECT_DIR/scripts/update.sh
User=root
EOF

cat << EOF > $UPDATER_PATH_FILE
[Unit]
Description=TrainingKiosk Updater Path Watcher

[Path]
PathExists=/tmp/trainingkiosk_update

[Install]
WantedBy=multi-user.target
EOF

sudo mv $UPDATER_SERVICE_FILE /etc/systemd/system/trainingkiosk-updater.service
sudo mv $UPDATER_PATH_FILE /etc/systemd/system/trainingkiosk-updater.path
sudo systemctl daemon-reload
sudo systemctl enable trainingkiosk-updater.path
sudo systemctl start trainingkiosk-updater.path

# 5. Configure Chromium Kiosk Autostart
echo "Configuring Chromium to autostart in Kiosk mode..."
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat << EOF > "$AUTOSTART_DIR/trainingkiosk.desktop"
[Desktop Entry]
Type=Application
Name=TrainingKiosk Frontend
Exec=chromium --password-store=basic --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 http://127.0.0.1:5000/
X-GNOME-Autostart-enabled=true
EOF

# 6. Start the service now
echo "Starting the backend service..."
sudo systemctl start trainingkiosk.service

echo "========================================================"
echo "Setup Complete!"
echo "The TrainingKiosk backend is now running."
echo "It will automatically start whenever the Pi is rebooted."
echo "You may need to reboot once for Chromium autostart to take effect."
echo "========================================================"
