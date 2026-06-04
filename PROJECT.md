# Project: Raspberry Pi Kiosk Update Mechanism

## Architecture
- **Update Script**: A Bash script `update_and_reboot.sh` that executes git commands, pip install, and reboots.
- **Systemd Service**: A oneshot systemd service `kiosk-updater.service` that calls the bash script. Running as root or a user with passwordless reboot permissions.
- **Web API**: Flask endpoint `/api/system/update` that starts the systemd service via DBus or `sudo systemctl start kiosk-updater.service` (assuming the `kiosk` user has passwordless sudo for this specific command, or using another mechanism to avoid password prompts). Wait, standard Linux tools.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Update Script | Bash script for update and reboot | none | DONE |
| 2 | Systemd Service & Sudoers | Systemd service definition and necessary system configuration | M1 | DONE |
| 3 | Flask Web API Integration | Python endpoint `/api/system/update` triggering the service | M2 | DONE |

## Interface Contracts
### Web API ↔ Systemd
- The Web API triggers the update via `sudo /bin/systemctl start kiosk-updater.service` or similar non-blocking, detached approach without requiring an interactive shell.

## Code Layout
- `update_and_reboot.sh` -> Root directory or `scripts/`
- `kiosk-updater.service` -> Root directory or `systemd/`
- `app.py` or similar -> Flask application
