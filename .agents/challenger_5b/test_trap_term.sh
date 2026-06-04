#!/bin/bash
set -e
trap 'echo REBOOT' EXIT
trap 'exit 1' TERM INT

echo "Running sleep..."
sleep 10
echo "Should not reach this"
