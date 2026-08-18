/* app.js — Core orchestrator: mode switching, game state reset, event listeners, bootstrap */

// ===========================================
// Core State
// ===========================================
let stopHoldTimeout = null;
let currentAppMode = 'skillplayer';
let startHoldTimeout = null;

// Debug helper: logs to both console AND the on-screen admin log panel
function clientLog(msg) {
    console.log(msg);
    const consoleEl = document.getElementById('admin-log-console');
    if (consoleEl) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = msg;
        consoleEl.appendChild(entry);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }
}

function startStopHold() {
    // Prevent multiple triggers if already holding
    if (stopHoldTimeout) return;

    clientLog('[StopHold] startStopHold() CALLED');

    // Use calibration stop bar if in calibration mode, otherwise use quiz stop bar
    const barId = calibrationMode ? 'calibration-stop-progress' : 'stop-progress';
    const bar = document.getElementById(barId);
    clientLog('[StopHold] Looking for bar: ' + barId + ' Found: ' + !!bar);
    if (!bar) return;

    // Instantly reset visual state (fixes animation ignoring trigger)
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth; // Force reflow

    // Start animation
    bar.style.transition = 'width 1s linear';
    bar.style.width = '100%';
    clientLog('[StopHold] Animation started, timer set for 1000ms');

    stopHoldTimeout = setTimeout(() => {
        clientLog('[StopHold] Timer FIRED! Calling stopQuizAttempt()');
        stopQuizAttempt();
        cancelStopHold(); // Reset visual
    }, 1000);
}

function cancelStopHold() {
    clientLog('[StopHold] cancelStopHold() called, had timeout: ' + !!stopHoldTimeout);
    if (stopHoldTimeout) {
        clearTimeout(stopHoldTimeout);
        stopHoldTimeout = null;
    }
    // Reset both progress bars
    const quizBar = document.getElementById('stop-progress');
    const calibrationBar = document.getElementById('calibration-stop-progress');

    if (quizBar) {
        quizBar.style.transition = 'width 0.2s ease-out';
        quizBar.style.width = '0%';
    }
    if (calibrationBar) {
        calibrationBar.style.transition = 'width 0.2s ease-out';
        calibrationBar.style.width = '0%';
    }
}

// Hold-to-Start Logic (0.5s hold with bottom-to-top fill)
function startHoldToStart() {
    if (startHoldTimeout) return;

    const bar = document.getElementById('start-progress');
    if (!bar) return;

    // Reset
    bar.style.transition = 'none';
    bar.style.height = '0%';
    void bar.offsetWidth;

    // Animate fill from bottom to top
    bar.style.transition = 'height 0.5s linear';
    bar.style.height = '100%';

    startHoldTimeout = setTimeout(() => {
        cancelStartHold();
        startQuiz();
    }, 500);
}

function cancelStartHold() {
    if (startHoldTimeout) {
        clearTimeout(startHoldTimeout);
        startHoldTimeout = null;
    }
    const bar = document.getElementById('start-progress');
    if (bar) {
        bar.style.transition = 'height 0.15s ease-out';
        bar.style.height = '0%';
    }
}

// ===========================================
// Master Game State Reset
// ===========================================
function resetGameState() {
    console.log('[System] Resetting Game State...');

    // 1. Stop all Timers/Intervals
    clearInterval(quizTimerInterval);
    clearInterval(stealTimerInterval);
    clearInterval(streakExpiryInterval);
    clearTimeout(streakTimerTimeout);
    clearTimeout(stopHoldTimeout);
    clearTimeout(calibrationPostAnswerTimer);

    quizTimerInterval = null;
    stealTimerInterval = null;
    streakTimerTimeout = null;
    streakExpiryInterval = null;
    stopHoldTimeout = null;
    calibrationPostAnswerTimer = null;

    // 2. Reset Game Flags
    quizIsGameActive = false;
    quizIsAnswerLocked = false;
    calibrationMode = false;

    // 3. Reset UI Visuals (Timers, Bars, Indicators)
    cancelStopHold(); // Resets stop bars

    if (quizElements.stealIndicator) quizElements.stealIndicator.classList.add('hidden');
    if (document.getElementById('streak-indicator')) {
        document.getElementById('streak-indicator').classList.add('hidden');
    }

    // Reset Lockout Bars
    document.querySelectorAll('.lock-overlay').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.lockout-bar').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.player-score-container').forEach(el => el.classList.remove('locked'));

    // 4. End Gamepad Session (if active)
    if (socket && socket.connected) {
        socket.emit('end_session');
    }

    console.log('[System] Game State Reset Complete');
}

// ===========================================
// App Mode Switching
// ===========================================
function switchAppMode(mode) {
    currentAppMode = mode;

    // If switching away from quiz, always reset it
    if (mode === 'skillplayer') {
        resetQuiz();
    }

    // Update tab active states
    document.querySelectorAll('.app-mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Switch sidebar content
    document.querySelectorAll('.sidebar-mode-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${mode}-sidebar`).classList.add('active');

    // Switch main content
    document.querySelectorAll('.app-mode-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${mode}-content`).classList.add('active');

    // Load data for the mode
    if (mode === 'quiz') {
        loadQuizLeaderboard();
    }
}

// ===========================================
// Event Listeners
// ===========================================

// Keyboard shortcuts for quiz answers (A, B, C, D)
document.addEventListener('keydown', (e) => {
    if (currentAppMode !== 'quiz' || !quizIsGameActive || quizIsAnswerLocked) return;

    const key = e.key.toUpperCase();
    const keyMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

    if (key in keyMap) {
        const buttons = quizElements.answersContainer.querySelectorAll('.quiz-answer-btn');
        if (buttons[keyMap[key]] && !buttons[keyMap[key]].disabled) {
            selectQuizAnswer(keyMap[key]);
        }
    }
});

// Enter key to submit quiz name
quizElements.playerName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitQuizScore();
});

// Close tooltip when clicking outside
document.addEventListener('click', function () {
    const tooltip = document.getElementById('fixed-quiz-tooltip');
    if (tooltip && tooltip.style.visibility === 'visible') {
        hideFixedTooltip();
    }
});

// Close admin menu when clicking outside
document.addEventListener('click', function (e) {
    const container = document.querySelector('.admin-container');
    if (container && !container.contains(e.target) && adminMenuOpen) {
        closeAdminMenu();
    }
});

// Force Gamepad selection when 2P is chosen
document.querySelectorAll('input[name="player-mode"]').forEach(input => {
    input.addEventListener('change', (e) => {
        const mouseBtn = document.querySelector('.input-toggle-btn[data-mode="mouse"]');
        if (e.target.value === '2') {
            setInputMode('gamepad');
            if (mouseBtn) {
                mouseBtn.classList.add('disabled');
                mouseBtn.title = "Mouse disabled in 2-Player Mode";
            }
        } else {
            if (mouseBtn) {
                mouseBtn.classList.remove('disabled');
                mouseBtn.title = "Mouse Mode";
            }
        }
    });
});

// ===========================================
// Bootstrap
// ===========================================
loadCategories();
loadSkills();
loadTotalViews();
loadChangelog();
loadQuizLeaderboard();
