#!/bin/bash
mkdir -p test_dir
cd test_dir
echo "old" > original.sh
ln -s original.sh my_symlink
echo "new" > new.sh
cp new.sh my_symlink
cat original.sh
ls -l my_symlink original.sh
