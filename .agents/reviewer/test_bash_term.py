import subprocess

script = """#!/bin/bash
trap 'echo "rebooting in EXIT"' EXIT

kill -TERM $$
echo "Should not reach here"
"""

with open("test_bash_term.sh", "w") as f:
    f.write(script)

p = subprocess.run(["C:\\Program Files\\Git\\bin\\bash.exe", "test_bash_term.sh"], capture_output=True, text=True)
print("STDOUT:", p.stdout)
print("STDERR:", p.stderr)
print(f"Exit code: {p.returncode}")
