// gamepad.js - SocketIO gamepad client + HTML5 Gamepad API Fallback

import { moveFocus, selectFocused } from './navigation.js?v=5.0';

let socket = null;
let connected = false;

// Local HTML5 Gamepad API fallback state
const localGamepads = {}; 
let bindingActive = false;
let playersNeeded = 1;
let boundPlayers = 0; // count of bound players
let gamepadToPlayerMap = {}; // mapping gamepad.index -> player index (0 or 1)

function isEasterEggActive() {
  return document.getElementById('asteroids-canvas') !== null || document.getElementById('tanks-canvas') !== null;
}

// Standard mappings (Xbox-like)
const BTN_A = 0;
const BTN_B = 1;
const BTN_X = 2;
const BTN_Y = 3;
const BTN_LB = 4;
const BTN_RB = 5;
const BTN_START = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

export function initGamepad() {
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('connect', () => { connected = true; console.log('Gamepad socket connected'); });
    socket.on('disconnect', () => { connected = false; console.log('Gamepad socket disconnected'); });
    
    socket.on('gamepad_dpad', (data) => {
      if (!isEasterEggActive()) moveFocus(data.direction);
      window.dispatchEvent(new CustomEvent('app_gamepad_dpad', { detail: { direction: data.direction, player: (data.player || 1) - 1 } }));
    });
    
    socket.on('gamepad_button', (data) => {
      let btnName = null;
      if (data.action === 'select') btnName = 'Select';
      else if (data.button_index === 0) btnName = 'X';
      else if (data.button_index === 1) btnName = 'A';
      else if (data.button_index === 2) btnName = 'B';
      else if (data.button_index === 3) btnName = 'Y';
      else if (data.button_index === 4 || data.action === 'lb' || data.action === 'review_prev') btnName = 'LB';
      else if (data.button_index === 5 || data.action === 'rb' || data.action === 'skip') btnName = 'RB';
      
      const playerIndex = (data.player || 1) - 1; // Convert backend 1-index to frontend 0-index
      
      if (btnName) {
        if (btnName === 'A' && !isEasterEggActive()) selectFocused();
        window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: btnName, player: playerIndex } }));
      }
      
      // Also dispatch raw event for tester
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: data }));
    });
    
    socket.on('gamepad_start_down', (data) => {
      window.dispatchEvent(new CustomEvent('app_gamepad_start_down'));
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: { action: 'start_down', ...data } }));
    });
    socket.on('gamepad_start_up', (data) => {
      window.dispatchEvent(new CustomEvent('app_gamepad_start_up'));
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: { action: 'start_up', ...data } }));
    });
    socket.on('gamepad_dpad', (data) => {
      if (!isEasterEggActive()) moveFocus(data.direction);
      window.dispatchEvent(new CustomEvent('app_gamepad_dpad', { detail: { direction: data.direction, player: (data.player || 1) - 1 } }));
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: data }));
    });
    
    socket.on('gamepad_axes', (data) => {
      const playerIndex = (data.player || 1) - 1;
      window.dispatchEvent(new CustomEvent('app_gamepad_axes', { detail: { player: playerIndex, axes: [data.x, data.y] } }));
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: { action: 'AXES', ...data } }));
    });
    
    // Listen for backend binding events
    socket.on('gamepad_bound', (data) => {
      boundPlayers++;
      window.dispatchEvent(new CustomEvent('app_gamepad_binding', { detail: { 
        ready: boundPlayers >= playersNeeded,
        players_bound: boundPlayers,
        target: playersNeeded
      }}));
      if (boundPlayers >= playersNeeded) bindingActive = false;
    });
    
    socket.on('raw_evdev_button', (data) => {
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: { action: 'RAW_EVDEV_SCANCODE', ...data } }));
    });
    
    socket.on('raw_evdev_axis', (data) => {
      window.dispatchEvent(new CustomEvent('raw_gamepad_backend', { detail: { action: 'RAW_EVDEV_AXIS', ...data } }));
    });
  } else {
    console.warn('Socket.IO not found. Proceeding with Local HTML5 Gamepad support only.');
    // Only start HTML5 Gamepad polling as a fallback when there is NO backend.
    // On the Pi, the backend handles all gamepad input via evdev/socket.io.
    // Running both causes duplicate/conflicting signals (e.g. RB seen as START).
    requestAnimationFrame(pollLocalGamepads);
  }
}

function pollLocalGamepads() {
  // If the backend socket is connected, it handles all gamepad input via evdev.
  // Skip HTML5 polling entirely to prevent duplicate/conflicting signals.
  if (connected) {
    requestAnimationFrame(pollLocalGamepads);
    return;
  }

  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  
  for (let i = 0; i < gps.length; i++) {
    const gp = gps[i];
    if (!gp) continue;
    
    if (!localGamepads[gp.index]) {
      localGamepads[gp.index] = { lastButtons: [], lastAxes: [] };
    }
    
    const state = localGamepads[gp.index];
    
    // Check Buttons
    for (let b = 0; b < gp.buttons.length; b++) {
      const pressed = gp.buttons[b].pressed;
      const wasPressed = state.lastButtons[b];
      
      if (pressed && !wasPressed) {
        handleLocalButtonDown(gp.index, b);
      } else if (!pressed && wasPressed) {
        handleLocalButtonUp(gp.index, b);
      }
      state.lastButtons[b] = pressed;
    }
    
    // Check Axes (simplified D-PAD via analog sticks)
    const axesThreshold = 0.5;
    const currentAxes = [
      gp.axes[0] < -axesThreshold, // Left
      gp.axes[0] > axesThreshold,  // Right
      gp.axes[1] < -axesThreshold, // Up
      gp.axes[1] > axesThreshold   // Down
    ];
    
    const wasAxes = state.lastAxes || [false, false, false, false];
    
    if (currentAxes[0] && !wasAxes[0]) dispatchDpad(gp.index, 'left');
    if (currentAxes[1] && !wasAxes[1]) dispatchDpad(gp.index, 'right');
    if (currentAxes[2] && !wasAxes[2]) dispatchDpad(gp.index, 'up');
    if (currentAxes[3] && !wasAxes[3]) dispatchDpad(gp.index, 'down');
    
    // Fix for some zero delay encoders mapping D-pad to HTML5 buttons 12-15 instead of axes
    let axisX = gp.axes[0] || 0;
    let axisY = gp.axes[1] || 0;
    if (Math.abs(axisX) < 0.1 && Math.abs(axisY) < 0.1) {
        if (gp.buttons.length > 15) {
            if (gp.buttons[14].pressed) axisX = -1;
            else if (gp.buttons[15].pressed) axisX = 1;
            if (gp.buttons[12].pressed) axisY = -1;
            else if (gp.buttons[13].pressed) axisY = 1;
        }
    }

    // Dispatch raw axes for continuous movement games (like Asteroids and Tanks)
    window.dispatchEvent(new CustomEvent('app_gamepad_axes', { 
      detail: { player: gamepadToPlayerMap[gp.index] || 0, axes: [axisX, axisY] } 
    }));
    
    state.lastAxes = currentAxes;
  }
  
  requestAnimationFrame(pollLocalGamepads);
}

function handleLocalButtonDown(gpIndex, buttonIndex) {
  // Binding phase logic
  if (bindingActive) {
    if (buttonIndex >= 0 && gamepadToPlayerMap[gpIndex] === undefined) {
      // Bind this gamepad to the next player
      gamepadToPlayerMap[gpIndex] = boundPlayers;
      boundPlayers++;
      
      window.dispatchEvent(new CustomEvent('app_gamepad_binding', { detail: { 
        ready: boundPlayers >= playersNeeded,
        players_bound: boundPlayers,
        target: playersNeeded
      }}));
      
      if (boundPlayers >= playersNeeded) {
        bindingActive = false;
      }
    }
    return; // Don't process other buttons while binding
  }

  // If we get here, normal game logic
  const player = gamepadToPlayerMap[gpIndex] !== undefined ? gamepadToPlayerMap[gpIndex] : 0;
  
  if (buttonIndex === BTN_START) {
    window.dispatchEvent(new CustomEvent('app_gamepad_start_down'));
    return;
  }
  
  let btnName = null;
  if (buttonIndex === 0) btnName = 'X';
  if (buttonIndex === 1) btnName = 'A';
  if (buttonIndex === 2) btnName = 'B';
  if (buttonIndex === 3) btnName = 'Y';
  if (buttonIndex === BTN_LB) btnName = 'LB';
  if (buttonIndex === BTN_RB) btnName = 'RB';
  
  if (buttonIndex === DPAD_UP) dispatchDpad(gpIndex, 'up');
  if (buttonIndex === DPAD_DOWN) dispatchDpad(gpIndex, 'down');
  if (buttonIndex === DPAD_LEFT) dispatchDpad(gpIndex, 'left');
  if (buttonIndex === DPAD_RIGHT) dispatchDpad(gpIndex, 'right');
  
  if (btnName) {
    if (btnName === 'A' && !isEasterEggActive()) selectFocused();
    window.dispatchEvent(new CustomEvent('app_gamepad_btn', { detail: { button: btnName, player: player } }));
  }
}

function handleLocalButtonUp(gpIndex, buttonIndex) {
  if (buttonIndex === BTN_START) {
    window.dispatchEvent(new CustomEvent('app_gamepad_start_up'));
  }
}

function dispatchDpad(gpIndex, direction) {
  if (bindingActive) return;
  if (!isEasterEggActive()) moveFocus(direction);
  window.dispatchEvent(new CustomEvent('app_gamepad_dpad', { detail: { direction, player: gamepadToPlayerMap[gpIndex] || 0 } }));
}

export function startBinding(playerCount) {
  if (socket && connected) {
    socket.emit('start_binding', { players: playerCount });
  }
  // Local HTML5 binding logic (runs in parallel, whichever detects first wins)
  bindingActive = true;
  playersNeeded = playerCount;
  boundPlayers = 0;
  gamepadToPlayerMap = {};
  window.dispatchEvent(new CustomEvent('app_gamepad_binding', { detail: { 
    ready: false,
    players_bound: 0,
    target: playerCount
  }}));
}

export function endSession() {
  if (socket && connected) {
    socket.emit('end_session');
  }
  bindingActive = false;
  gamepadToPlayerMap = {};
}

export function isConnected() {
  // Returns true if Socket.IO is connected OR if HTML5 Gamepads are detected
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const hasLocal = Array.from(gps).some(gp => gp !== null);
  return connected || hasLocal;
}

export function getGamepadForPlayer(playerIndex) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < gps.length; i++) {
    if (gps[i] && gamepadToPlayerMap[gps[i].index] === playerIndex) {
      return gps[i];
    }
  }
  return gps[playerIndex];
}
