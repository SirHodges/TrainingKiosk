set -e
trap 'echo Rebooting EXIT' EXIT TERM INT
kill -TERM $$
