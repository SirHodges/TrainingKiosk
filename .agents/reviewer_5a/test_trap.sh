#!/bin/bash
set -e

trap 'echo "EXIT trap triggered"; kill -TERM $$' EXIT
trap 'echo "TERM trap triggered"; exit 1' TERM INT

echo "Exiting..."
exit 0
