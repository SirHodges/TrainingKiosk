# Handoff Report

## 1. Observation
- `bash -n` on `scripts/setup_pi.sh` and `scripts/update.sh` succeeded without errors.
- In `scripts/setup_pi.sh`, lines 62-65 copy `update.sh` to `/usr/local/bin/trainingkiosk-update`, set the owner to `root:root`, and make it executable. The `trainingkiosk-updater.service` (lines 70-79) specifies `ExecStart=/usr/local/bin/trainingkiosk-update` with `User=root`.
- In `scripts/update.sh`, lines 7-9 define the trap logic:
  ```bash
  trap '/sbin/reboot' EXIT
  trap 'exit 1' TERM INT
  ```
- In `scripts/setup_pi.sh`, `PROJECT_DIR` is set to the repository path. It is then injected into the systemd updater service using `Environment="PROJECT_DIR=$PROJECT_DIR"` (line 76).
- In `scripts/update.sh`, `PROJECT_DIR` is set using `PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)}"`, allowing the script to use the environment variable if defined.

## 2. Logic Chain
1. **LPE Vector Remediation**: The `trainingkiosk-updater.service` runs as root and points to a root-owned, immutable (to non-root users) copy of the update script (`/usr/local/bin/trainingkiosk-update`). Because it does not directly execute a script in a user-writable directory (like `$HOME/trainingkiosk`), an attacker cannot trivially escalate privileges by modifying the update script before the systemd path-trigger runs it.
2. **Trap Logic**: The `EXIT` trap executes `/sbin/reboot` ensuring that the device always reboots when the script finishes. Setting the `TERM` and `INT` traps to `exit 1` correctly passes execution back to the `EXIT` trap upon a terminating signal without causing a recursive double reboot loop (since `exit` natively triggers `EXIT` traps without overriding them with duplicate `/sbin/reboot` invocations). By not specifying an `ERR` trap and using `set -e`, normal error exits trigger the `EXIT` trap organically, preserving the logical flow.
3. **Project Directory Resolution**: Because `update.sh` is copied to `/usr/local/bin`, a relative path resolution using `BASH_SOURCE[0]` would mistakenly resolve to `/usr/local`. However, `update.sh` uses parameter expansion `${PROJECT_DIR:-...}` to default to the environment variable. Since `setup_pi.sh` bakes the original repository path into the `trainingkiosk-updater.service` as an environment variable (`Environment="PROJECT_DIR=$PROJECT_DIR"`), the correct directory is seamlessly injected into the copied script.

## 3. Caveats
- If the `trainingkiosk-update` script in `/usr/local/bin` is manually executed by root outside of systemd, the `PROJECT_DIR` environment variable will not be set, causing it to resolve to `/usr/local` and fail cleanly (due to missing `.git` and `set -e`). This is an edge-case and does not impact normal operation.
- Updates made to `scripts/update.sh` in future git commits will not automatically apply to the `/usr/local/bin/trainingkiosk-update` file unless the update script copies itself or `setup_pi.sh` is rerun.

## 4. Conclusion
**Verdict: PASS**
The reviewed files correctly implement the requested functionality. The Local Privilege Escalation (LPE) vector is remediated securely, the trap logic works as intended and avoids recursive double reboots, and the project directory is accurately resolved via environment variables.

## 5. Verification Method
1. Run `bash -n scripts/setup_pi.sh` and `bash -n scripts/update.sh` to confirm no syntax errors.
2. Inspect `scripts/setup_pi.sh` to confirm `/usr/local/bin/trainingkiosk-update` receives `root:root` ownership and is the target of `trainingkiosk-updater.service`.
3. Test a script with `trap '/sbin/reboot' EXIT` and `trap 'exit 1' TERM INT` locally, sending a `SIGTERM` to verify that `EXIT` triggers exactly once.
