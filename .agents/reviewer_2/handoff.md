# Review of TrainingKiosk Update & Reboot Mechanism (Iteration 3)

## 1. Observation
- `scripts/update.sh` uses `trap '/sbin/reboot' EXIT TERM INT` which catches signals but does not explicitly `exit`.
- The implementer's untracked test scripts (`test_trap2.py`, `test_trap3.py`, `test_trap.sh`, `test_trap3.sh`) show active testing of this bash trap behavior.
- In `test_trap.sh`, the implementer explicitly used `trap 'echo "trapped!"; exit' TERM INT` because they discovered that a signal trap without `exit` allows bash to continue execution of the script after the trap finishes. 
- Despite proving this requirement in their test sandbox, the implementer intentionally or negligently left the `exit` out of the production script `scripts/update.sh`.

## 2. Logic Chain
- When a `SIGTERM` or `SIGINT` is sent to `update.sh` (e.g., if the user stops the systemd service or during shutdown), the trap executes `/sbin/reboot`.
- Because the trap lacks an explicit `exit`, bash continues executing the rest of the script (e.g., `git fetch`, `git reset`, `pip install`) while the system is initiating shutdown. This is a severe data corruption risk, defeating the purpose of a "highly reliable" mechanism.
- The fact that the implementer diagnosed, successfully reproduced, and fixed this exact issue in their test script (`test_trap2.py` / `test_trap.sh`) but failed to apply the fix to the production code constitutes a shortcut that bypasses the intended task. This fits the pattern of fabricating a passing test/verification output while leaving the core logic defective.
- Per system constraints, this behavior qualifies as an Integrity Violation.

## 3. Caveats
- It is possible this was an accidental omission rather than a deliberate facade, but the rules dictate treating evidence of self-certifying work (or fixing tests while ignoring main code) as an integrity violation.

## 4. Conclusion
**Verdict: VETO (REQUEST_CHANGES) — INTEGRITY VIOLATION**

Critical finding (INTEGRITY VIOLATION): The implementer discovered that signal traps require an explicit `exit` to halt script execution upon interruption, applied this fix to their test script, but omitted it from `scripts/update.sh`. 
Fix required: Update the trap in `scripts/update.sh` to include `exit` for signals (e.g., `trap '/sbin/reboot; exit' TERM INT` and `trap '/sbin/reboot' EXIT`). 

## 5. Verification Method
- Execute `bash -c "trap 'echo reboot' EXIT TERM INT; kill -TERM \$\$; echo continuing"`. Observe that "continuing" is printed.
- Verify that `scripts/update.sh` lacks the `exit` keyword in its trap, while `test_trap.sh` explicitly uses it.
