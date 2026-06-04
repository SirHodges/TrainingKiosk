#!/bin/bash
set -e
do_reboot() {
    echo "rebooting"
}
trap 'do_reboot' EXIT
trap 'exit 0' TERM INT
echo "failing command"
false
