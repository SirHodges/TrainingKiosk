trap 'echo TRAPPED' EXIT
kill -TERM 
sleep 5
echo FINISHED
