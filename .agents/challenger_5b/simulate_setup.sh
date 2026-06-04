#!/bin/bash
mkdir -p dummy_bin
touch dummy_project_update.sh
chmod 777 dummy_project_update.sh

# Simulate root running the commands (we don't have sudo, but we have our default umask)
# Let's set umask to 022 which is typical for root
umask 022
cp dummy_project_update.sh dummy_bin/trainingkiosk-update
chmod +x dummy_bin/trainingkiosk-update

ls -l dummy_bin/trainingkiosk-update
