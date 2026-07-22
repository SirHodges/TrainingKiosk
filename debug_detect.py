#!/usr/bin/env python3
"""Check why gamepads aren't being detected."""
import evdev

keywords = ['gamepad', 'joystick', 'controller', 'game', '8bitdo', 'snes']

for path in evdev.list_devices():
    d = evdev.InputDevice(path)
    name_lower = d.name.lower()
    match = any(k in name_lower for k in keywords)
    print(f"{path}: '{d.name}' -> {'MATCH' if match else 'no match'}")
