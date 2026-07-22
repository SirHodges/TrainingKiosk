"""
Connects the Gamepad system to the SocketIO web server.

This file acts as a bridge. When the GamepadHandler detects a physical
button press, it calls a function here, which then broadcasts that event
over a WebSocket to the frontend web browser.
"""

def setup_input_bridge(socketio, gamepad_handler):
    """
    Hooks up the gamepad event callback to emit SocketIO messages.
    Also listens for commands from the web client (like ending a session).
    """
    
    # 1. Forward events from the Gamepad to the Browser
    def handle_gamepad_event(event_type, payload):
        """
        Callback fired by the GamepadHandler.
        We simply take the event and blast it out to any connected web clients.
        """
        print(f"Bridge forwarding: {event_type} -> {payload}", flush=True)
        socketio.emit(event_type, payload)
        
    gamepad_handler.set_callback(handle_gamepad_event)
    
    # 2. Handle commands coming FROM the Browser TO the Backend
    @socketio.on('start_binding')
    def handle_start_binding(data=None):
        """Frontend is telling us a game is about to start, get ready."""
        # Clear all existing sessions so players must re-bind
        for p_id in list(gamepad_handler.sessions.keys()):
            gamepad_handler.sessions[p_id] = None
            socketio.emit('binding_status', {'player': p_id, 'bound': False})

    @socketio.on('end_session')
    def handle_end_session(data=None):
        """
        Frontend is telling us the game is over.
        We free up the player slots so new controllers can join next time.
        """
        player = data.get('player') if data else None
        
        # Iterate over a copy of items to avoid dictionary changed size during iteration
        for p_id, path in list(gamepad_handler.sessions.items()):
            if path is not None and (player is None or p_id == player):
                gamepad_handler.sessions[p_id] = None
                socketio.emit('binding_status', {'player': p_id, 'bound': False})
