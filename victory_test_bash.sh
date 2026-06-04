#!/bin/bash

# Create a mock environment
MOCK_DIR=$(pwd)/mock_bin
mkdir -p "$MOCK_DIR"

# Mock sudo
cat << 'EOF' > "$MOCK_DIR/sudo"
#!/bin/bash
shift # remove -u
shift # remove user
if [ "$1" = "-H" ]; then
    shift
    shift
fi
"$@"
EOF
chmod +x "$MOCK_DIR/sudo"

export PATH="$MOCK_DIR:$PATH"

# Mock git
cat << 'EOF' > "$MOCK_DIR/git"
#!/bin/bash
echo "MOCK_GIT_CALLED: $*"
# Simulate git failure if requested
if [ "$FAIL_GIT" = "1" ]; then
    echo "Failing git intentionally"
    exit 1
fi
exit 0
EOF
chmod +x "$MOCK_DIR/git"

# Mock pip
mkdir -p "$PROJECT_DIR/venv/bin"
cat << 'EOF' > "$PROJECT_DIR/venv/bin/pip"
#!/bin/bash
echo "MOCK_PIP_CALLED: $*"
exit 0
EOF
chmod +x "$PROJECT_DIR/venv/bin/pip"

export PROJECT_DIR=$(pwd)
export APP_USER="pi"

echo "--- TEST 1: Normal execution ---"
bash scripts/update.sh > test1.log 2>&1
echo "Exit code: $?"
cat test1.log
grep -q "/sbin/reboot" test1.log || echo "TEST 1 FAILED"

echo "--- TEST 2: Git Failure ---"
export FAIL_GIT=1
bash scripts/update.sh > test2.log 2>&1
echo "Exit code: $?"
cat test2.log
grep -q "/sbin/reboot" test2.log || echo "TEST 2 FAILED"

echo "--- TEST 3: Termination Signal ---"
export FAIL_GIT=0
# To test termination reliably, we need update.sh to wait so we can kill it
# But it runs quickly. Let's create a wrapper that sources update.sh but we can't easily.
# Let's mock git to sleep, then kill update.sh
cat << 'EOF' > "$MOCK_DIR/git"
#!/bin/bash
echo "MOCK_GIT_CALLED: $*"
sleep 5
exit 0
EOF
chmod +x "$MOCK_DIR/git"

bash scripts/update.sh > test3.log 2>&1 &
PID=$!
sleep 1
kill -TERM $PID
wait $PID
echo "Exit code: $?"
cat test3.log
grep -q "/sbin/reboot" test3.log || echo "TEST 3 FAILED"

echo "DONE"
