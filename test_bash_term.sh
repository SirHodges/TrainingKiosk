#!/bin/bash
trap 'echo "rebooting in EXIT"' EXIT

kill -TERM $$
echo "Should not reach here"
