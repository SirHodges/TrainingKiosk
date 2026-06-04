"""
Gamepad handling logic for Linux (Raspberry Pi) using the evdev library.

This module detects USB/Bluetooth gamepads (like the 8BitDo SN30),
listens for button presses, translates raw Linux input events into meaningful
buttons (A, B, X, Y, D-Pad), and manages player sessions (Player 1, Player 2).
"""

import threading
import time
from typing import Dict, Callable, Any, Optional

try:
    import evdev
    from evdev import InputDevice, categorize, ecodes
    EVDEV_AVAILABLE = True
except ImportError:
    EVDEV_AVAILABLE = False
    print("Warning: evdev not installed or not on Linux. Gamepad support disabled.")

class GamepadHandler:
    """
    Manages connections to physical gamepads and broadcasts their button events.
    Handles hot-plugging (disconnecting and reconnecting).
    """
    def __init__(self):
        self.devices: Dict[str, InputDevice] = {}
        self.threads: Dict[str, threading.Thread] = {}
        self.running = False
        
        # User-defined callback function to receive events
        # e.g., def my_callback(event_type, payload): pass
        self.event_callback: Optional[Callable[[str, Any], None]] = None
        
        # We assign Player 1 to the first controller that presses a button,
        # and Player 2 to the next different controller.
        self.sessions: Dict[int, str] = {1: None, 2: None} # Player ID -> Device Path
        
        # State tracking for long-presses (e.g., holding START to exit)
        self.start_pressed = {}
        
        if EVDEV_AVAILABLE:
            self.running = True
            # Start background thread to look for new controllers every few seconds
            self.monitor_thread = threading.Thread(target=self._monitor_devices, daemon=True)
            self.monitor_thread.start()

    def set_callback(self, callback: Callable[[str, Any], None]):
        """Sets the function that will be called when an event happens."""
        self.event_callback = callback

    def _emit(self, event_type: str, payload: Any):
        """Internal helper to trigger the callback if one is set."""
        if self.event_callback:
            self.event_callback(event_type, payload)

    def _monitor_devices(self):
        """Background loop that periodically checks for new gamepads."""
        while self.running:
            try:
                # Find all input devices on the system
                system_devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
                
                # Filter for things that look like gamepads
                for device in system_devices:
                    name_lower = device.name.lower()
                    is_gamepad = any(keyword in name_lower for keyword in 
                                   ['gamepad', 'joystick', 'controller', 'game', '8bitdo', 'snes'])
                    
                    if is_gamepad and device.path not in self.devices:
                        print(f"Gamepad connected: {device.name} at {device.path}")
                        self.devices[device.path] = device
                        
                        # Start a dedicated thread just to listen to this one gamepad
                        t = threading.Thread(target=self._listen_device, args=(device,), daemon=True)
                        self.threads[device.path] = t
                        t.start()
            except Exception as e:
                print(f"Error scanning for devices: {e}")
                
            time.sleep(5.0) # Check again in 5 seconds

    def _identify_player(self, device_path: str) -> Optional[int]:
        """Figures out if this device is Player 1 or Player 2."""
        for player_id, bound_path in self.sessions.items():
            if bound_path == device_path:
                return player_id
        return None

    def _bind_device(self, device_path: str, requested_player: int) -> bool:
        """Assigns a physical device to a logical player slot."""
        if self.sessions.get(requested_player) is None:
            # First check if this device is already bound to someone else
            existing = self._identify_player(device_path)
            if existing and existing != requested_player:
                # Unbind from old slot
                self.sessions[existing] = None
                
            self.sessions[requested_player] = device_path
            return True
        return False

    def _listen_device(self, device: 'InputDevice'):
        """
        The main event loop for a single gamepad.
        Reads raw Linux input events and translates them.
        """
        try:
            # Grab exclusive access to the device so standard Linux doesn't also process it
            device.grab()
        except IOError:
            print(f"Could not grab {device.name}. Is another process using it?")
            return

        try:
            for event in device.read_loop():
                if not self.running:
                    break
                    
                player_id = self._identify_player(device.path)
                
                if event.type == ecodes.EV_KEY:
                    # Button press/release
                    key_event = categorize(event)
                    self._handle_button(device.path, player_id, key_event)
                    
                elif event.type == ecodes.EV_ABS:
                    # D-pad or Joystick movement
                    self._handle_dpad(device.path, player_id, event)
                    
        except IOError:
            # Device was probably unplugged
            print(f"Gamepad disconnected: {device.name}")
        finally:
            self._cleanup_device(device.path)

    def _cleanup_device(self, path: str):
        """Cleans up internal state when a device disconnects."""
        if path in self.devices:
            try:
                self.devices[path].ungrab()
            except:
                pass
            del self.devices[path]
            
        if path in self.threads:
            del self.threads[path]
            
        # Free up the player slot if they disconnected
        player_id = self._identify_player(path)
        if player_id:
            self.sessions[player_id] = None
            self._emit('binding_status', {'player': player_id, 'bound': False})

    def _handle_button(self, path: str, player_id: Optional[int], event: Any):
        """Translates raw button codes into standard game actions."""
        # 1 = pressed down, 0 = released up, 2 = held
        if event.keystate not in (0, 1):
            return
            
        is_pressed = (event.keystate == 1)
        
        # ALWAYS emit the raw event for diagnostics (so the frontend tester can see unknown buttons)
        if is_pressed:
            self._emit('raw_evdev_button', {
                'scancode': event.scancode,
                'path': path
            })
            
        # Default mapping for many generic controllers
        # Map raw codes to standard index: 0=A, 1=B, 2=X, 3=Y
        button_map = {
            288: 0, # X on some controllers
            289: 1, # Y
            290: 2, # B
            291: 3, # A
            # 8BitDo SF30 specific mappings
            304: 3, # A (South)
            305: 2, # B (East)
            307: 0, # X (North)
            308: 1, # Y (West)
        }
        
        special_map = {
            297: 'start',
            314: 'start', # 8BitDo start
            296: 'select',
            315: 'select', # 8BitDo select
            292: 'review_prev', # L bumper
            293: 'skip',        # R bumper
            310: 'review_prev', # 8BitDo L
            311: 'skip'         # 8BitDo R
        }
        
        # Identify the button
        action = None
        button_index = None
        
        if event.scancode in button_map:
            button_index = button_map[event.scancode]
            action = 'answer'
        elif event.scancode in special_map:
            action = special_map[event.scancode]
            
        if not action and not button_index is not None:
            # Unknown button, ignore
            return
            
        # Handle binding (unbound controller pressing a button)
        if not player_id and is_pressed:
            # First button press makes them Player 1, second makes Player 2
            if not self.sessions[1]:
                self._bind_device(path, 1)
                player_id = 1
                self._emit('gamepad_bound', {'player': 1})
            elif not self.sessions[2]:
                self._bind_device(path, 2)
                player_id = 2
                self._emit('gamepad_bound', {'player': 2})
            else:
                # All slots full
                return
                
        if not player_id:
            return # Still not bound, ignore

        # Handle Start button special logic (hold to quit)
        if action == 'start':
            if is_pressed:
                self.start_pressed[path] = time.time()
                self._emit('gamepad_start_down', {'player': player_id})
            else:
                hold_duration = 0
                if path in self.start_pressed:
                    hold_duration = time.time() - self.start_pressed[path]
                    del self.start_pressed[path]
                self._emit('gamepad_start_up', {'player': player_id, 'hold_duration_ms': int(hold_duration * 1000)})
            return

        # Handle normal buttons (only trigger on press down, not release)
        if is_pressed:
            self._emit('gamepad_button', {
                'player': player_id,
                'action': action,
                'button_index': button_index
            })

    def _handle_dpad(self, path: str, player_id: Optional[int], event: Any):
        """Translates D-Pad (HAT) or left analog stick movement."""
        if not player_id:
            return
            
        direction = None
        
        # ABS_HAT0X / ABS_HAT0Y are the standard D-pad events
        if event.code == ecodes.ABS_HAT0X or event.code == ecodes.ABS_X:
            if event.value < -100 or event.value == -1:
                direction = 'left'
            elif event.value > 100 or event.value == 1:
                direction = 'right'
        elif event.code == ecodes.ABS_HAT0Y or event.code == ecodes.ABS_Y:
            if event.value < -100 or event.value == -1:
                direction = 'up'
            elif event.value > 100 or event.value == 1:
                direction = 'down'
                
        if direction:
            self._emit('gamepad_dpad', {
                'player': player_id,
                'direction': direction
            })

    def shutdown(self):
        """Stops all threads cleanly."""
        self.running = False
