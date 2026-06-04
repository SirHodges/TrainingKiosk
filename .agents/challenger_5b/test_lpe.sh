#!/bin/bash
# test_lpe.sh

# We will create a fake "sudo" command for this test that records its invocations.
export PATH="$PWD/fake_bin:$PATH"
mkdir -p fake_bin
cat << 'EOF' > fake_bin/sudo
#!/bin/bash
if [ "$1" = "cp" ]; then
    cp "$2" "$3"
elif [ "$1" = "chown" ]; then
    # Fake chown for MSYS/Windows, we just ignore it for the test
    echo "Faking chown $2 $3"
elif [ "$1" = "chmod" ]; then
    chmod "$2" "$3"
else
    "$@"
fi
EOF
chmod +x fake_bin/sudo

# Prepare fake project dir
export PROJECT_DIR="$PWD/fake_project"
mkdir -p "$PROJECT_DIR/scripts"
echo "echo UPDATE" > "$PROJECT_DIR/scripts/update.sh"
chmod 777 "$PROJECT_DIR/scripts/update.sh"

# Extract the relevant setup_pi.sh lines
cat << 'EOF' > fake_setup.sh
#!/bin/bash
# Ensure the update script is executable and secure from LPE
sudo cp "$PROJECT_DIR/scripts/update.sh" fake_bin/trainingkiosk-update
sudo chown root:root fake_bin/trainingkiosk-update
sudo chmod +x fake_bin/trainingkiosk-update
EOF
chmod +x fake_setup.sh

# Run it
./fake_setup.sh

# Check if the simulated copied file has the right properties
echo "Permissions of the copied file:"
ls -l fake_bin/trainingkiosk-update
