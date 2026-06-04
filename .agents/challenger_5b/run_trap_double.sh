#!/bin/bash
bash test_trap_double.sh &
PID=$!
sleep 1
# Send TERM to trigger exit
kill -TERM $PID
sleep 0.5
# Send another TERM while it's in the EXIT trap
kill -TERM $PID
wait $PID
