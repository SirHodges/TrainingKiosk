#!/usr/bin/env python3
"""Check if evdev can read gamepad events. Run with sudo if needed."""
import evdev
import sys

path = "/dev/input/event13"
try:
    d = evdev.InputDevice(path)
    print(f"Device: {d.name}")
    print(f"Path: {d.path}")
    
    # Try to grab
    try:
        d.grab()
        print("GRAB: SUCCESS")
        d.ungrab()
    except Exception as e:
        print(f"GRAB FAILED: {e}")
    
    # Check capabilities
    caps = d.capabilities()
    if 1 in caps:  # EV_KEY
        print(f"Buttons (scancodes): {caps[1]}")
    if 3 in caps:  # EV_ABS
        print(f"Axes: {[a[0] for a in caps[3]]}")
    
    # Read a few events
    print("\nWaiting for 1 button press (5 second timeout)...")
    import select
    r, _, _ = select.select([d], [], [], 5.0)
    if r:
        for event in d.read():
            if event.type == evdev.ecodes.EV_KEY:
                cat = evdev.categorize(event)
                state = "PRESSED" if cat.keystate == 1 else "RELEASED" if cat.keystate == 0 else "HELD"
                print(f"BUTTON: scancode={cat.scancode} state={state}")
            elif event.type == evdev.ecodes.EV_ABS:
                print(f"AXIS: code={event.code} value={event.value}")
    else:
        print("No events in 5 seconds.")
except PermissionError as e:
    print(f"PERMISSION ERROR: {e}")
    print("Run with sudo!")
except Exception as e:
    print(f"ERROR: {e}")
