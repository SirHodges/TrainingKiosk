#!/bin/bash
set -e
trap 'echo REBOOT' EXIT
trap 'exit 1' TERM INT

echo "Running failing command"
false
echo "Should not reach this"
