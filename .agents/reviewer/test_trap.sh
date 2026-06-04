#!/bin/bash
echo "Start"
do_reboot() {
    echo "Rebooting..."
    exit 0
}
trap 'do_reboot' EXIT TERM INT
sleep 10
