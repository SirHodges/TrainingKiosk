/* gamepad.js — Socket.IO connection, gamepad input handling, cursor navigation */

const p1PosDisplay = document.getElementById('p1-pos');
const p2PosDisplay = document.getElementById('p2-pos');
const p1Cursor = document.getElementById('p1-cursor');
const p2Cursor = document.getElementById('p2-cursor');

const socket = io();

let lastP1Pos = { x: 0, y: 0 };
let lastP2Pos = { x: 0, y: 0 };

socket.on('connect', () => {
    console.log('[SocketIO] Connected');
});

socket.on('disconnect', () => {
    console.warn('[SocketIO] Disconnected');
});

// Server Log Handler for Admin Console
socket.on('server_log', (data) => {
    const consoleEl = document.getElementById('admin-log-console');
    if (!consoleEl) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    // Format: [HH:MM:SS] Message
    entry.textContent = `[${data.timestamp}] ${data.message}`;

    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight; // Auto-scroll
});

// Gamepad button handler
socket.on('gamepad_button', (data) => {
    console.log('[Gamepad] Button received:', data);

    // AUTO-SELECT: If we're on the quiz start screen, auto-switch to gamepad mode
    const startScreen = document.getElementById('quiz-start-screen');
    if (startScreen && startScreen.classList.contains('active') && currentAppMode === 'quiz') {
        if (inputMode !== 'gamepad') {
            setInputMode('gamepad');
            console.log('[Gamepad] Auto-selected gamepad mode from start screen');
        }
        // B/X/Y just switch to gamepad mode — A and START come in as gamepad_start_down
        return;
    }

    // DEBUG: Update onscreen counter
    const statusText = document.getElementById('binding-status-text');
    if (statusText && inputMode === 'gamepad') {
        statusText.textContent = `Received Input! (Idx: ${data.button_index !== undefined ? data.button_index : data.action})`;
        statusText.style.color = "cyan";
    }

    // Only handle gamepad input when in gamepad mode and quiz mode
    if (inputMode === 'gamepad' && currentAppMode === 'quiz') {
        // Check if in calibration mode
        // Check if in calibration mode
        if (calibrationMode) {
            const answerIndex = (data.action && data.action !== 'answer') ? data.action : data.button_index;

            if (calibrationState === 'question' && !calibrationAnswerLocked) {
                if (answerIndex === 'skip') {
                    // RB = Mark for Review
                    markForReview();
                } else if (answerIndex === 'review_prev') {
                    // LB = Mark Previous for Review
                    markPreviousForReview();
                } else if (answerIndex >= 0 && answerIndex <= 3) {
                    selectCalibrationAnswer(answerIndex);
                }
            }
            return;
        }


        // FAILSAFE: If we receive a button press but are still on the binding screen,
        const bindingScreen = document.getElementById('quiz-binding-screen');
        if (bindingScreen && bindingScreen.classList.contains('active')) {
            console.log('[Gamepad] Button received on binding screen - forcing start');
            showQuizScreen('countdown');
            runCountdown();
            return; // Don't process this first button press as an answer
        }

        if (quizIsGameActive && !quizIsAnswerLocked) {
            const answerIndex = (data.action && data.action !== 'answer') ? data.action : data.button_index;
            if (answerIndex === 'skip') {
                console.log('[Gamepad] SKIP command received');
                const player = data.player || 1;
                skipQuestion(player);
            } else if (answerIndex >= 0 && answerIndex <= 3) {
                const player = data.player || 1;
                selectQuizAnswer(answerIndex, player);
            }
        }
    }
});

// Gamepad bound handler - triggered when a controller claims the session
socket.on('gamepad_bound', (data) => {
    console.log('[Gamepad] Controller bound:', data);
    const statusText = document.getElementById('binding-status-text');
    const player = data.player || 1;

    if (quizPlayerCount > 1) {
        // 2-Player Logic
        if (player === 1) {
            if (statusText) {
                statusText.textContent = "PLAYER 1 READY! Waiting for Player 2...";
                statusText.style.color = "#2196F3"; // Blue
                statusText.style.fontSize = "24px";
                statusText.style.fontWeight = "bold";
            }
            // Do NOT start yet, wait for P2
        } else if (player === 2) {
            if (statusText) {
                statusText.textContent = "PLAYER 2 READY! STARTING...";
                statusText.style.color = "#F44336"; // Red
            }
            // Both ready, start
            if (inputMode === 'gamepad') {
                setTimeout(() => {
                    showQuizScreen('countdown');
                    runCountdown();
                }, 1000);
            }
        }
    } else {
        // 1-Player Logic (or Calibration Mode)
        if (statusText) {
            statusText.textContent = "GAMEPAD BOUND! STARTING...";
            statusText.style.color = "#00ff00"; // Green
            statusText.style.fontSize = "24px";
            statusText.style.fontWeight = "bold";
        }

        if (inputMode === 'gamepad') {
            setTimeout(() => {
                if (calibrationMode) {
                    // Start calibration game
                    document.querySelectorAll('.quiz-screen').forEach(screen => screen.classList.remove('active'));
                    document.getElementById('calibration-game-screen').classList.add('active');
                    displayCalibrationQuestion();
                } else {
                    // Regular quiz countdown
                    showQuizScreen('countdown');
                    runCountdown();
                }
            }, 500);
        }
    }
});

// Listen for START button hold events (Stop Attempt) - Global Socket
socket.on('gamepad_start_down', function () {
    clientLog('[StopHold] gamepad_start_down received! appMode:' + currentAppMode + ' gameActive:' + quizIsGameActive + ' calibration:' + calibrationMode);

    // If on the quiz start screen, auto-select gamepad and hold-to-start
    const startScreen = document.getElementById('quiz-start-screen');
    if (startScreen && startScreen.classList.contains('active') && currentAppMode === 'quiz') {
        if (inputMode !== 'gamepad') {
            setInputMode('gamepad');
        }
        startHoldToStart();
        return;
    }

    if (currentAppMode === 'quiz') {
        if (calibrationMode) {
            // End calibration with START hold
            startStopHold();
        } else if (quizIsGameActive) {
            startStopHold();
        }
    }
});

socket.on('gamepad_start_up', function () {
    clientLog('[StopHold] gamepad_start_up received!');
    // Cancel hold-to-start if on start screen
    const startScreen = document.getElementById('quiz-start-screen');
    if (startScreen && startScreen.classList.contains('active')) {
        cancelStartHold();
        return;
    }
    cancelStopHold();
});

// D-pad handler for left/right player count switching on start screen
socket.on('gamepad_dpad', function (data) {
    // Auto-select gamepad mode if not already
    if (inputMode !== 'gamepad') {
        setInputMode('gamepad');
    }

    const startScreen = document.getElementById('quiz-start-screen');
    if (startScreen && startScreen.classList.contains('active') && currentAppMode === 'quiz') {
        if (data.direction === 'left') {
            // Select 1 Player
            document.querySelector('input[name="player-mode"][value="1"]').checked = true;
            updateQuizRules(1);
            console.log('[Gamepad] D-pad LEFT: Selected 1 Player');
        } else if (data.direction === 'right') {
            // Select 2 Players
            document.querySelector('input[name="player-mode"][value="2"]').checked = true;
            updateQuizRules(2);
            console.log('[Gamepad] D-pad RIGHT: Selected 2 Players');
        }
    }
});

// Binding Status Handler
socket.on('binding_status', (data) => {
    console.log('[Gamepad] Binding status:', data);
    const statusText = document.getElementById('binding-status-text');
    if (statusText) {
        statusText.textContent = data.message;
        if (data.bound) {
            statusText.textContent = `Player ${data.player} Bound!`;
            statusText.style.color = '#22c55e'; // green
        } else {
            statusText.textContent = `Listening for Player ${data.player}...`;
            statusText.style.color = '#eab308'; // yellow
        }
    }
});

socket.on('state_update', (state) => {
    if (state.p1) {
        lastP1Pos = state.p1;
        if (p1Cursor) p1Cursor.style.transform = `translate(${state.p1.x}px, ${state.p1.y}px)`;
        if (p1PosDisplay) p1PosDisplay.textContent = `${Math.round(state.p1.x)},${Math.round(state.p1.y)}`;
    }
    if (state.p2) {
        lastP2Pos = state.p2;
        if (p2Cursor) p2Cursor.style.transform = `translate(${state.p2.x}px, ${state.p2.y}px)`;
        if (p2PosDisplay) p2PosDisplay.textContent = `${Math.round(state.p2.x)},${Math.round(state.p2.y)}`;
    }
});

socket.on('p1_click', () => handleVirtualClick('p1', lastP1Pos));
socket.on('p2_click', () => handleVirtualClick('p2', lastP2Pos));

// Handle Clicks
function handleVirtualClick(player, position) {
    // Find element at coordinates
    // Hide cursor momentarily so we don't click the cursor itself
    const cursor = player === 'p1' ? p1Cursor : p2Cursor;
    cursor.style.display = 'none';

    const el = document.elementFromPoint(position.x, position.y);

    // Show cursor again
    cursor.style.display = 'block';

    if (el) {
        console.log(`[${player.toUpperCase()}] Clicked:`, el.tagName, el.className);

        // If it's a button or interactive, click it
        // We might need to bubble up to find the closest button
        const clickable = el.closest('button') || el.closest('a') || (el.onclick ? el : null);

        if (clickable) {
            clickable.click();

            // Add visual ripple effect
            createRipple(position.x, position.y, player);
        }
    }
}

function createRipple(x, y, player) {
    const ripple = document.createElement('div');
    ripple.className = `click-ripple ${player}`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}

function cancelBinding() {
    showQuizStartScreen();
}
