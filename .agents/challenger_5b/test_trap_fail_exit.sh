#!/bin/bash
set -e
trap 'echo "EXIT TRAP"; false; echo "THIS SHOULD NOT PRINT"' EXIT
trap 'exit 1' TERM INT

false
echo "Done"
