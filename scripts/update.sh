#!/bin/bash
# TrainingKiosk Update Script
# Pulls the latest code from Git, updates dependencies, and reboots.

set -e

# Ensure we always reboot on exit
trap '/sbin/reboot' EXIT TERM INT

# Remove the update flag file
rm -f /tmp/trainingkiosk_update

# Change to the project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$PROJECT_DIR" || exit 1

# Determine the owner of the project directory to run git/pip as that user
APP_USER=$(stat -c '%U' "$PROJECT_DIR")

echo "Updating TrainingKiosk from repository..."

# Force discard any local changes and pull latest
sudo -u "$APP_USER" git fetch origin
sudo -u "$APP_USER" git reset --hard origin/main

# Install any new dependencies using venv pip directly (no activate needed)
sudo -H -u "$APP_USER" "$PROJECT_DIR/venv/bin/pip" install -r requirements.txt

echo "Rebooting system in 3 seconds..."
sleep 3
