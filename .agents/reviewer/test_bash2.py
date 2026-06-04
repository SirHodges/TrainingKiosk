import subprocess

script = """#!/bin/bash
do_reboot() {
    echo "rebooting"
    exit 0
}
trap 'do_reboot' EXIT TERM INT
echo "done"
"""

with open("test_bash.sh", "w") as f:
    f.write(script)

p = subprocess.run(["C:\\Program Files\\Git\\bin\\bash.exe", "test_bash.sh"], capture_output=True, text=True)
print("STDOUT:", p.stdout)
print("STDERR:", p.stderr)
