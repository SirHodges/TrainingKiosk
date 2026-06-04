#!/bin/bash
# TrainingKiosk Update Script
# Pulls the latest code from Git, updates dependencies, and restarts the service.

set -e

# Change to the project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$PROJECT_DIR"

echo "Updating TrainingKiosk from repository..."

# Pull latest changes
git pull

# Activate virtual environment and install any new dependencies
source venv/bin/activate
pip install -r requirements.txt

echo "Rebooting system..."
sudo systemctl reboot

echo "Update complete!"
