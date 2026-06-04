import subprocess

script = """#!/bin/bash
set -e
do_reboot() {
    echo "rebooting"
}
trap 'do_reboot' EXIT
trap 'exit 0' TERM INT
echo "failing command"
false
"""

with open("test_bash_fail.sh", "w") as f:
    f.write(script)

p = subprocess.run(["C:\\Program Files\\Git\\bin\\bash.exe", "test_bash_fail.sh"])
print(f"Exit code: {p.returncode}")
