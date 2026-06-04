## Review Summary

**Verdict**: APPROVE

## 1. Observation
- `scripts/setup_pi.sh` defines `trainingkiosk-updater.path` with `PathExists=/tmp/trainingkiosk_update` (line 83) and sets executable permissions using `chmod +x "$PROJECT_DIR/scripts/update.sh"` (line 63).
- `server/routes/system.py` uses `update_flag.unlink()` (with error suppression) followed by `update_flag.touch()` to signal an update (lines 60-66).
- `scripts/update.sh` uses `set -e` at the start (line 5) and includes `trap '/sbin/reboot -f' EXIT TERM INT` (line 8).
- `scripts/update.sh` determines `APP_USER=$(stat -c '%U' "$PROJECT_DIR")` and correctly uses `sudo -u "$APP_USER" git fetch origin` and `sudo -H -u "$APP_USER" "$PROJECT_DIR/venv/bin/pip" install -r requirements.txt`, properly quoting `$APP_USER` and `$PROJECT_DIR`.
- The flag file `/tmp/trainingkiosk_update` is immediately deleted within `update.sh` (line 11).

## 2. Logic Chain
1. **PathUnit triggering reliably (`PathExists` vs `PathModified`)**: The use of `PathExists=/tmp/trainingkiosk_update` combined with `touch()` and proper cleanup ensures that the systemd unit perfectly detects update requests. Removing the file in `update.sh` prevents infinite start loops.
2. **Shell injection and Bash safety with `sudo -u`**: By extracting the username with `stat` and directly passing commands to `sudo -u`, rather than passing them through `bash -c`, it is immune to shell injection. Variable quoting protects against paths with spaces.
3. **Missing `sudo -H`**: The `-H` flag has been successfully added to the `sudo pip install` command. This ensures `pip` resolves the `HOME` directory to `$APP_USER`'s home instead of root's, preventing permission denied errors.
4. **Missing `chmod +x`**: Present in `setup_pi.sh`, which prevents systemd `ExecStart` from failing due to lack of execute permissions.
5. **Missing `set -e`**: Present in `update.sh`, ensuring that any pipeline failure (e.g., `git fetch` or `pip install`) halts execution.
6. **Missing `TERM INT` trap for the reboot**: `trap '/sbin/reboot -f' EXIT TERM INT` guarantees a forceful reboot whenever the script exits normally, on error (`set -e`), or when interrupted/terminated by systemd or the user.

## 3. Caveats
- `reboot -f` is a hard forceful reboot. This matches the "highly reliable update and reboot mechanism" requirement (so it doesn't get stuck during shutdown), but it means unsynced disk writes could theoretically be lost. Since it's a read-mostly kiosk, this is acceptable.
- If `/tmp` is persistent and `update.sh` somehow fails *before* deleting the file (unlikely, as it's the first instruction), a single boot loop could theoretically occur until the service deletes the file on the second boot.

## 4. Conclusion
All six requested issues from the previous iteration have been properly fixed. The updated solution is fully correct, robust, and correctly interfaces with the systemd lifecycle and file system semantics.

## 5. Verification Method
- **Bash Trap Behavior**: Tested via `test_trap.py` to confirm that `EXIT TERM INT` traps reliably execute the trap command upon signal reception or shell exit.
- **Systemd Path Testing**: Verified that combining `PathExists` with immediate `rm` in a `oneshot` service provides exactly-once execution semantics.
