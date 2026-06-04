#!/bin/bash

# Mock reboot
mkdir -p sbin
cat << 'REB' > sbin/reboot
#!/bin/bash
echo "MOCK REBOOT CALLED" >> reboot.log
REB
chmod +x sbin/reboot

cat << 'SCRIPT' > mock_update.sh
#!/bin/bash
set -e
export PATH="$(pwd)/sbin:$PATH"

trap 'sbin/reboot' EXIT
trap 'exit 1' TERM INT

echo "Running update..."
sleep 2
echo "Done."
SCRIPT
chmod +x mock_update.sh

rm -f reboot.log

# Test 1: failing command
cat << 'SCRIPT' > mock_update_fail.sh
#!/bin/bash
set -e
export PATH="$(pwd)/sbin:$PATH"

trap 'sbin/reboot' EXIT
trap 'exit 1' TERM INT

echo "Running update..."
false
echo "Done."
SCRIPT
chmod +x mock_update_fail.sh

echo "Running Test 1..."
./mock_update_fail.sh || true
echo "Fail test log:"
cat reboot.log || true
echo "---"
rm -f reboot.log

# Test 2: SIGTERM
echo "Running Test 2..."
./mock_update.sh &
PID=$!
sleep 0.5
kill -TERM $PID
wait $PID || true
echo "SIGTERM test log:"
cat reboot.log || true
