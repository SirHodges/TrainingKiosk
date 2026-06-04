#!/bin/bash
do_reboot() {
    echo "rebooting"
    exit 0
}
trap 'do_reboot' EXIT TERM INT
kill -TERM $$
echo "Should not reach here"
