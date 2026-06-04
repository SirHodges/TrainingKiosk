#!/bin/bash
set -e
export PATH="$(pwd)/sbin:$PATH"

trap 'sbin/reboot' EXIT
trap 'exit 1' TERM INT

echo "Running update..."
false
echo "Done."
