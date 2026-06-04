import subprocess
import time

script = """#!/bin/bash
trap 'echo "rebooting in EXIT"' EXIT

sleep 10
echo "After sleep"
"""

with open("test_bash_term_sleep.sh", "w") as f:
    f.write(script)

p = subprocess.Popen(["C:\\Program Files\\Git\\bin\\bash.exe", "test_bash_term_sleep.sh"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
time.sleep(1)
p.terminate() # sends SIGTERM
stdout, stderr = p.communicate()
print("STDOUT:", stdout)
print("STDERR:", stderr)
print(f"Exit code: {p.returncode}")
