#!/bin/bash
rm -f source.sh dest.sh
touch source.sh
chmod 777 source.sh
# emulate root's umask
umask 0022
cp source.sh dest.sh
ls -l dest.sh
