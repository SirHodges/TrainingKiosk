#!/bin/bash
# TrainingKiosk Update Script
# Pulls the latest code from Git, updates dependencies, and restarts the service.

set -e

# Change to the project root directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$PROJECT_DIR"

echo "Updating TrainingKiosk from repository..."

# Force discard any local changes and pull latest
git fetch origin
git reset --hard origin/main

# Activate virtual environment and install any new dependencies
source venv/bin/activate
pip install -r requirements.txt

echo "Rebooting system..."
# Try standard reboot methods first
sudo /sbin/reboot -f &
sleep 5
# Nuclear fallback: kernel sysrq reboot (bypasses everything)
sudo bash -c 'echo 1 > /proc/sys/kernel/sysrq && echo b > /proc/sysrq-trigger'

echo "Update complete!"
