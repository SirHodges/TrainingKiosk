import subprocess

script = """#!/bin/bash
trap 'echo "rebooting"' EXIT
trap 'exit 0' TERM INT

kill -TERM $$
echo "Should not reach here"
"""

with open("test_bash.sh", "w") as f:
    f.write(script)

p = subprocess.run(["C:\\Program Files\\Git\\bin\\bash.exe", "test_bash.sh"], capture_output=True, text=True)
print("STDOUT:", p.stdout)
print("STDERR:", p.stderr)
