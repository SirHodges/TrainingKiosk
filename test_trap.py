import subprocess, time
p = subprocess.Popen(['bash', '-c', 'trap "echo TRAPPED" EXIT; sleep 5'], stdout=subprocess.PIPE)
time.sleep(1)
p.terminate()
print("OUTPUT:", p.communicate()[0])
