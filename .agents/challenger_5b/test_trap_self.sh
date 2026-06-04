#!/bin/bash
trap "echo REBOOT" EXIT
trap "exit 1" TERM INT
echo "Killing self"
kill -TERM $$
