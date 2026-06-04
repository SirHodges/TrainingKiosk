# Progress

Last visited: 2026-06-04T10:57:31-04:00

- Created workspace.
- Wrote tests to simulate trap logic in bash (`test_trap_fail.sh`, `test_trap_term.sh`, `test_trap_double.sh`).
- Verified that `trap 'exit 1' TERM INT` and `trap '/sbin/reboot' EXIT` behaves correctly and only triggers exactly once on failures and signals.
- Investigated LPE attack possibilities by simulating the setup steps (`cp`, `chmod +x`, `chown root:root`). 
- Checked POSIX `cp` rules and confirmed resulting file permissions would be `755` (`-rwxr-xr-x`) owned by root, effectively blocking write access for the `pi` user.
- Addressed TOCTOU or symlink attacks related to setup execution and found the `update.sh` correctly drops privileges before executing directory specific scripts.
- Generated `handoff.md` and sent a message to the orchestrator.
