set -e
trap 'echo Rebooting EXIT' EXIT
trap 'echo TERM; exit 1' TERM INT
kill -TERM $$
