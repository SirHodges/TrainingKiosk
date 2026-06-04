#!/bin/bash
echo "Testing LPE vulnerability..."
# Simulate the setup environment
mkdir -p mock_root/usr/local/bin
mkdir -p project/scripts

# Create original script with world-writable permissions (worst case for attacker)
echo "echo vulnerable" > project/scripts/update.sh
chmod 777 project/scripts/update.sh

# Run the setup commands (mocking sudo)
cp project/scripts/update.sh mock_root/usr/local/bin/trainingkiosk-update
# chown root:root is mocked here as just making sure we check permissions
# We assume it's owned by root. The key is whether others can write to it.
chmod +x mock_root/usr/local/bin/trainingkiosk-update

# Check permissions
PERMS=$(stat -c '%a' mock_root/usr/local/bin/trainingkiosk-update)
echo "Permissions of generated updater: $PERMS"

# Is it writable by others?
if [ -w mock_root/usr/local/bin/trainingkiosk-update ]; then
    # In this mock, we are the owner so it's writable by us, but we need to check the "others" bit.
    # We can check if the last digit of PERMS is 2, 3, 6, or 7.
    OTHER_PERM=${PERMS: -1}
    if [[ "$OTHER_PERM" =~ [2367] ]]; then
        echo "FAIL: Updater is world-writable!"
        exit 1
    fi
fi
echo "PASS: Updater is not world-writable."
