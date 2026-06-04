#!/bin/bash
trap 'echo reboot' EXIT TERM INT
kill -TERM $$
echo "continuing..."
