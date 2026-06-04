import subprocess
import time
import threading
import os

def run_bash():
    subprocess.run(['bash', 'test_trap3.sh'])

with open('test_trap3.sh', 'w', newline='\n') as f:
    f.write('''#!/bin/bash
trap 'echo "trapped!"' EXIT TERM INT
echo "Sleeping for 10 seconds (pid $$)..."
sleep 10
echo "Done sleeping"
''')

t = threading.Thread(target=run_bash)
t.start()
time.sleep(1)
# Send SIGTERM to bash using kill command via subprocess
subprocess.run(['bash', '-c', 'kill -TERM $(pgrep -f "bash test_trap3.sh")'])
t.join()
