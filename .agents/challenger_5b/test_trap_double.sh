#!/bin/bash
trap 'echo "EXIT TRAP START"; sleep 2; echo "EXIT TRAP END"' EXIT
trap 'echo "TERM TRAP"; exit 1' TERM INT

echo "Running sleep..."
sleep 10
echo "Done"
