#!/bin/bash
# TrainingKiosk Update Script
# Pulls the latest code from Git, updates dependencies, and reboots.

# Change to the project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$PROJECT_DIR"

echo "Updating TrainingKiosk from repository..."

# Force discard any local changes and pull latest
git fetch origin
git reset --hard origin/main

# Install any new dependencies using venv pip directly (no activate needed)
"$PROJECT_DIR/venv/bin/pip" install -r requirements.txt

echo "Rebooting system in 3 seconds..."
sleep 3

# Reboot the system
sudo /sbin/reboot -f
