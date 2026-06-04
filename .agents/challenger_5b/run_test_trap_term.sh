#!/bin/bash
bash test_trap_term.sh &
PID=$!
sleep 1
kill -TERM $PID
wait $PID
