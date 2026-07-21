#!/usr/bin/env python3
"""Diagnostic script: reads ALL gamepad events and prints them."""
import evdev
import select

# List all devices
print("=== ALL INPUT DEVICES ===")
for path in evdev.list_devices():
    d = evdev.InputDevice(path)
    name = d.name.lower()
    print(f"  {path}: {d.name}")

# Find gamepads
gamepads = []
for path in evdev.list_devices():
    d = evdev.InputDevice(path)
    name = d.name.lower()
    if any(kw in name for kw in ['gamepad', 'joystick', 'controller', 'game', '8bitdo', 'snes']):
        gamepads.append(d)
        print(f"\n>>> GAMEPAD FOUND: {d.name} at {path}")
        caps = d.capabilities(verbose=True)
        if ('EV_KEY', 1) in caps:
            print(f"    Buttons: {[b[0] for b in caps[('EV_KEY', 1)]]}")
        if ('EV_ABS', 3) in caps:
            print(f"    Axes: {[a[0][0] for a in caps[('EV_ABS', 3)]]}")

if not gamepads:
    print("NO GAMEPADS FOUND!")
    exit(1)

print(f"\n=== LISTENING FOR EVENTS ON {len(gamepads)} GAMEPAD(S) ===")
print("Press buttons on the controller. Press Ctrl+C to stop.\n")

try:
    while True:
        r, _, _ = select.select(gamepads, [], [], 1.0)
        for dev in r:
            for event in dev.read():
                if event.type == evdev.ecodes.EV_KEY:
                    cat = evdev.categorize(event)
                    state = "PRESSED" if cat.keystate == 1 else "RELEASED" if cat.keystate == 0 else "HELD"
                    print(f"[BUTTON] scancode={cat.scancode}  state={state}  keycode={cat.keycode}")
                elif event.type == evdev.ecodes.EV_ABS:
                    print(f"[AXIS]   code={event.code}  value={event.value}")
except KeyboardInterrupt:
    print("\nDone.")
