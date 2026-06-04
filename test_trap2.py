import subprocess
with open('test_trap.sh', 'w', newline='\n') as f:
    f.write('''#!/bin/bash
trap 'echo "trapped!"; exit' TERM INT
trap 'echo "trapped exit!"' EXIT
kill -TERM $$
echo "Should not reach here"
''')

subprocess.run(['bash', 'test_trap.sh'])
