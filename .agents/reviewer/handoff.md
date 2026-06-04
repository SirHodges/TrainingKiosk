## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Bash Safety Violation (Shell Injection) in `update.sh`
- **Where**: `scripts/update.sh` line 25
- **What**: `sudo -u "$APP_USER" bash -c "\"$PROJECT_DIR/venv/bin/pip\" install -r requirements.txt"`
- **Why**: Passing interpolated strings containing file paths to an inner `bash -c` introduces a shell evaluation vulnerability. If `PROJECT_DIR` contains characters like `$`, they are improperly evaluated by the inner shell (e.g. `/path/to/my$dir` becomes `/path/to/my/venv/bin/pip`).
- **Suggestion**: Bypass `bash -c` entirely and run directly: `sudo -u "$APP_USER" "$PROJECT_DIR/venv/bin/pip" install -r requirements.txt`

### [Critical] Path Unit Trigger Reliability (`PathModified=`)
- **Where**: `scripts/setup_pi.sh` line 79 (`PathModified=/tmp/trainingkiosk_update`) and `server/routes/system.py` line 61 (`update_flag.touch()`)
- **What**: The script relies on `PathModified=` (which maps to `IN_MODIFY` or `IN_CLOSE_WRITE`) combined with python's `Path.touch()`. 
- **Why**: While creating a non-existent file with `touch()` works, if the file already exists, `Path.touch()` in Python simply updates the file timestamps (`os.utime`). This generates an `IN_ATTRIB` inotify event. `PathModified=` ignores `IN_ATTRIB`, so the update will silently fail to trigger.
- **Suggestion**: Use `PathExists=/tmp/trainingkiosk_update` in the systemd path unit. This perfectly matches the semantics of a flag file that gets removed by the triggered script.

### [Major] Pip Cache Permission Issue
- **Where**: `scripts/update.sh` line 25
- **What**: Running `pip` with `sudo -u "$APP_USER"` without the `-H` flag.
- **Why**: Since `update.sh` runs under a root systemd service, the `$HOME` environment variable remains `/root`. `pip install` will attempt to use `/root/.cache/pip`, causing permission warnings/errors for `$APP_USER`.
- **Suggestion**: Use the `-H` flag: `sudo -H -u "$APP_USER" "$PROJECT_DIR/venv/bin/pip" ...`

### [Major] Missing Execution Permissions for `update.sh`
- **Where**: `scripts/setup_pi.sh`
- **What**: systemd `ExecStart=` requires an executable script, but the setup script does not explicitly `chmod +x` the target.
- **Why**: If the repository loses the executable bit or is downloaded outside git, the updater unit will crash with `203/EXEC`.
- **Suggestion**: Add `chmod +x "$PROJECT_DIR/scripts/update.sh"` in `setup_pi.sh` before defining the service.

### [Minor] Missing `set -e` in `update.sh`
- **Where**: `scripts/update.sh`
- **What**: The script lacks `set -e` or failure checks.
- **Why**: If `cd "$PROJECT_DIR"` fails (e.g., directory moved), the script will blindly execute `git reset` and `pip install` in the root directory, then execute the trap to reboot. 
- **Suggestion**: Add `set -e` at the top of the script.

## Verified Claims
- **Reboot via trap**: `trap '/sbin/reboot' EXIT` reliably ensures a reboot executes even if intermediate commands fail or if the script receives a standard termination signal.
- **Python Exception Handling**: `trigger_update()` correctly wraps the file operation in a `try/except` block returning a 500 status on failure.

## Conclusion
While the structural implementation of the update mechanism is correct, there are critical Bash injection flaws and reliability issues with the systemd Path unit triggers. The code requires modifications before approval.
