# Original User Request

## 2026-06-04T14:18:58Z

Create a highly reliable update and reboot mechanism for a Raspberry Pi kiosk application. The mechanism must securely perform code updates and system reboots when triggered by a web API endpoint, without failing due to process termination or sudo terminal restrictions.

Working directory: C:/Users/sirho/Desktop/Kiosk v2/trainingkiosk
Integrity mode: development

## Requirements

### R1. Robust Execution Context
Design and implement an update mechanism that executes completely independently of the Flask/Waitress web server process. It must not hang or fail if the web server process is terminated, and it must avoid `sudo` issues related to missing interactive terminals (TTY).

### R2. Update Flow
When triggered, the mechanism must:
1. Navigate to the project directory.
2. Force discard local changes (`git fetch origin` followed by `git reset --hard origin/main`).
3. Install Python dependencies directly using the virtual environment's pip.
4. Reboot the system.

### R3. Guaranteed Reboot
The system must reboot at the end of the script regardless of whether the git commands or pip installation succeed or fail.

### R4. Standard Tooling
The solution must rely strictly on standard Linux/Debian tools (e.g., bash scripts, systemd, standard Python) to ensure it is lean and easily installable on any fresh Raspberry Pi without third-party frameworks.

## Acceptance Criteria

### Execution & Independence
- [ ] The update sequence successfully completes a git pull and system reboot when triggered via the `/api/system/update` endpoint.
- [ ] Killing the Flask process immediately after triggering the update does NOT stop the update or the reboot.

### Error Resilience
- [ ] If `git` is intentionally broken or encounters an error, the system still proceeds to reboot.
- [ ] The reboot command does not hang indefinitely waiting for an interactive password prompt.
