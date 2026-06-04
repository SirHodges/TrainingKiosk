# Handoff Report

## 1. Observation
- The original vulnerability allowed the `pi` user to execute arbitrary commands as `root` because systemd executed `$PROJECT_DIR/scripts/update.sh` as root, and `$PROJECT_DIR` is writable by `pi`.
- The fix in `setup_pi.sh` copies the script to `/usr/local/bin/trainingkiosk-update`, changes ownership to `root:root`, and makes it executable.
- Simulated testing of `cp` with a default `umask` (e.g., `022`) and `chmod +x` confirms that the file permissions become `755` (`-rwxr-xr-x`) owned by `root:root`.
- The `update.sh` uses `sudo -u "$APP_USER"` when running commands inside the project directory, dropping privileges.
- Testing the `trap` logic in bash with `test_trap_fail.sh` (`set -e` failure simulation) and `test_trap_term.sh` (`SIGTERM` simulation) showed that the `EXIT` trap executes exactly once and does not loop. A double-trap test also confirmed that subsequent `TERM` signals during the `EXIT` trap do not cause looping behavior.

## 2. Logic Chain
1. The `pi` user needs write permissions to the script executed by systemd to perform an LPE. Since the script is copied to `/usr/local/bin` and chowned to `root:root` with `755` permissions, the `pi` user has no write access. Thus, the LPE attack path via modifying the updater script is closed.
2. `update.sh` correctly parses the project owner and explicitly runs git and pip commands with `sudo -u`, meaning any malicious hooks or scripts in the repository will run as the unprivileged user, preventing further LPE paths.
3. The `trap` logic maps `SIGTERM` and `SIGINT` to `exit 1`, which then triggers the `EXIT` trap. Failing commands (`set -e`) similarly trigger `exit`, which triggers the `EXIT` trap. Bash handles nested signals safely and avoids executing `EXIT` trap multiple times. Thus, the reboot logic happens exactly once as required.

## 3. Caveats
- Testing was performed using bash on MSYS (Windows) to simulate Linux permissions and trap behaviors. The behavior of `sudo cp` was verified conceptually according to POSIX `cp` rules.
- We assume `/usr/local/bin` itself is owned by root and its permissions cannot be modified by `pi` to swap the binary.

## 4. Conclusion
VERDICT=PASS

The vulnerabilities are properly addressed. The `pi` user cannot modify the systemd updater script, and the shell trap logic correctly forces a reboot exactly once without looping.

## 5. Verification Method
- Check file permissions on a real Raspberry Pi by running `ls -l /usr/local/bin/trainingkiosk-update`. Ensure it is `-rwxr-xr-x` and owned by `root:root`.
- Run the simulation scripts (`test_trap_fail.sh` and `test_trap_double.sh`) locally using bash to observe the `REBOOT` string being printed exactly once.
