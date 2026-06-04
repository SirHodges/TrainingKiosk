import subprocess
PROJECT_DIR = "/tmp/my dir with spaces"
cmd = f'bash -c "\\"{PROJECT_DIR}/venv/bin/pip\\" install"'
print("Command:", cmd)
