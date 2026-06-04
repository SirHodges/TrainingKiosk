# Handoff Report

## 1. Observation
- `server/routes/system.py` uses `Path('/tmp/trainingkiosk_update').touch()` to trigger the update.
- `scripts/setup_pi.sh` defines a systemd Path unit with `PathModified=/tmp/trainingkiosk_update` which runs `scripts/update.sh` as root.
- `scripts/update.sh` defines `trap '/sbin/reboot' EXIT`.
- `scripts/update.sh` runs git and pip using `sudo -u "$APP_USER" bash -c "..."`.
- `scripts/update.sh` does not use `set -e` and does not trap termination signals like `SIGTERM`.
- `scripts/update.sh` uses `sudo -u` without the `-H` flag.

## 2. Logic Chain
- **Systemd Path Unit**: Correct. `PathModified` watches for `IN_CLOSE_WRITE`. The `touch()` command in Python creates the file and closes it (if it doesn't exist), triggering the event. Since `update.sh` deletes the flag file, it works reliably on subsequent triggers.
- **Trap Reboot Guarantee**: Incorrect. The `trap '/sbin/reboot' EXIT` only fires on a normal shell exit or when a trapped signal causes exit. If a command (e.g., `git fetch`) hangs and systemd hits its `TimeoutStartSec` (default 90s), systemd sends `SIGTERM`. Bash does NOT execute the `EXIT` trap on an unhandled `SIGTERM`. Thus, a timeout will leave the system without a reboot.
- **Git/Pip Safe Execution**: Partially correct/Safe but flawed. `sudo -u "$APP_USER"` correctly drops the EUID to the app user, bypassing git's dubious ownership errors and ensuring pip doesn't install root-owned files. However, omitting the `-H` flag means `$HOME` remains `/root` when run by systemd. Pip will attempt to use `/root/.cache/pip` (resulting in a permission warning), and git will look for config/keys in `/root/`.

## 3. Caveats
- I did not run the code on a real Raspberry Pi. I verified the logic using bash semantics and systemd documentation.
- Assuming the git repository is public/HTTPS and doesn't require SSH keys, the `$HOME` issue for git is non-fatal. Pip's cache permission error is also non-fatal.

## 4. Conclusion
**Verdict**: REQUEST_CHANGES (Veto)

The update mechanism does NOT guarantee a reboot due to flawed signal handling. 

Required Changes:
1. Fix `update.sh` signal trap to include `SIGTERM` and `SIGINT` (e.g., `trap '/sbin/reboot' EXIT TERM INT`) to guarantee reboot on systemd timeout.
2. Add `-H` to `sudo` commands (e.g., `sudo -H -u "$APP_USER"`) to properly set `$HOME` to the app user's home directory, avoiding permission warnings for pip cache and git config.
3. Enable `set -e` in `update.sh` to fail fast on errors rather than continuing in an unknown state.
4. Fix `setup_pi.sh` backend service `Environment="PATH=..."` which overrides the entire PATH instead of appending to it (e.g., `Environment="PATH=$PROJECT_DIR/venv/bin:/usr/bin:/bin"`).

## 5. Verification Method
- **Trap testing**: Run `bash -c "trap 'echo REBOOT' EXIT; kill -TERM $$"` and observe that REBOOT is NOT printed.
- **Sudo testing**: Run `sudo -u pi bash -c "echo $HOME"` vs `sudo -H -u pi bash -c "echo $HOME"`.
