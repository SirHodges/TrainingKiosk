/* quiz.js — Quiz game: state machine, timer, scoring, streaks, 2P steal, countdown */

let quizQuestions = [];
let quizCurrentQuestionIndex = 0;
let quizScore = 0;
// 2-Player State
let quizPlayerCount = 1;
let quizScores = { p1: 0, p2: 0 };
let quizLocks = { p1: false, p2: false };
// let quizTimers = { p1: 60, p2: 60 }; // Removed legacy individual timers
let quizStreaks = { p1: 0, p2: 0 };

// Legacy/Global (used for 1P or tracking)
let quizTimeRemaining = 60;

let quizTimerInterval = null;
let quizIsGameActive = false;
let quizIsAnswerLocked = false;
let endScreenAutoReturnTimer = null;
let quizSessionId = null;

let inputMode = 'mouse';

let quizStreak = 0;
let streakTimerTimeout = null;
let streakExpiryInterval = null;
const STREAK_EXPIRY_TIME = 7000; // 7 seconds
let streakTimeRemaining = STREAK_EXPIRY_TIME;

// Answer Tracking State
let questionDisplayTime = 0; // Timestamp when question was shown

// Detailed Stats Tracking
let gameStats = {
    correct: 0,
    wrong: 0,
    skips: 0,
    streakCount: 0, // Number of times a 3+ streak was achieved
    bestStreak: 0  // Highest streak level reached
};
let currentStreakLevel = 0; // To track if we just entered a new streak level

const quizElements = {
    timerFill: document.getElementById('quiz-timer-fill'),
    timerText: document.getElementById('quiz-timer-text'),
    score: document.getElementById('quiz-score'),
    questionNum: document.getElementById('quiz-question-num'),
    totalQuestions: document.getElementById('quiz-total-questions'),
    questionText: document.getElementById('quiz-question-text'),
    answersContainer: document.getElementById('quiz-answers-container'),
    feedback: document.getElementById('quiz-feedback'),
    finalScore: document.getElementById('quiz-final-score'),
    nameEntry: document.getElementById('quiz-name-entry'),
    playerName: document.getElementById('quiz-player-name'),
    endScoresList: document.getElementById('quiz-end-scores-list'),
    sidebarScoresList: document.getElementById('sidebar-scores-list'),
    stealIndicator: document.getElementById('steal-indicator'),
    stealText: document.getElementById('steal-text'),
    stealRing: document.getElementById('steal-ring-progress')
};

let stealTimerInterval = null;

function setInputMode(mode) {
    inputMode = mode;

    // Update toggle button states
    document.querySelectorAll('.input-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update answer container layout
    const answersContainer = document.getElementById('quiz-answers-container');
    if (answersContainer) {
        if (mode === 'gamepad') {
            answersContainer.classList.add('diamond-layout');
        } else {
            answersContainer.classList.remove('diamond-layout');
        }
    }

    // Update Start Quiz button text
    const startLabel = document.querySelector('#quiz-start-btn .start-label');
    if (startLabel) {
        startLabel.textContent = mode === 'gamepad' ? 'Hold START to begin' : 'Start Quiz';
    }
}

function showQuizScreen(screenName) {
    document.querySelectorAll('.quiz-screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(`quiz-${screenName}-screen`).classList.add('active');
}

function cancelBinding() {
    showQuizStartScreen();
}

function resetQuiz() {
    resetGameState();

    // Reset all state
    quizQuestions = [];
    quizCurrentQuestionIndex = 0;
    quizScore = 0;
    quizTimeRemaining = 60;
    quizIsAnswerLocked = false;

    // Reset UI
    quizElements.playerName.value = '';
    quizElements.nameEntry.classList.add('hidden');
    
    // Instantly reset timer display to full
    updateQuizTimerDisplay(true);

    // Reset streak
    resetStreak();

    // Show start screen
    showQuizScreen('start');

    // Reset UI Elements that might be hidden
    document.querySelectorAll('.input-toggle-btn').forEach(btn => btn.style.display = 'flex');
}

function showQuizStartScreen() {
    // Cancel auto-return timer if user clicks Play Again manually
    if (endScreenAutoReturnTimer) {
        clearInterval(endScreenAutoReturnTimer);
        endScreenAutoReturnTimer = null;
    }
    resetQuiz();
    loadQuizLeaderboard();
}

// New function to update rules based on mode selection
function updateQuizRules(mode) {
    const rules1p = document.getElementById('quiz-rules-1p');
    const rules2p = document.getElementById('quiz-rules-2p');
    const hint = document.querySelector('.quiz-hint');

    if (mode == 2) {
        if (rules1p) rules1p.classList.add('hidden');
        if (rules2p) rules2p.classList.remove('hidden');
        if (hint) hint.classList.add('hidden'); // Hint doesn't apply to lockout mode
    } else {
        if (rules1p) rules1p.classList.remove('hidden');
        if (rules2p) rules2p.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
    }
}

async function startQuiz() {
    resetGameState(); // Ensure clean slate

    try {
        // Add timestamp to prevent caching
        const response = await fetch(`/api/quiz/start?t=${Date.now()}`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            quizSessionId = data.session_id;
            // Check player mode & count first
            const playerModeInput = document.querySelector('input[name="player-mode"]:checked');
            quizPlayerCount = playerModeInput ? parseInt(playerModeInput.value) : 1;

            // FORCE GAMEPAD FOR 2-PLAYER
            if (quizPlayerCount > 1) {
                setInputMode('gamepad');
                // Hide toggles to prevent switching
                document.querySelectorAll('.input-toggle-btn').forEach(btn => btn.style.display = 'none');

                // Initialize 2-Player State
                quizScores = { p1: 0, p2: 0 };
                // quizTimers = { p1: 60, p2: 60 }; // Removed legacy
                quizStreaks = { p1: 0, p2: 0 };
                quizLocks = { p1: false, p2: false };
                quizTimeRemaining = 60; // Use shared timer
            } else {
                // 1-Player State
                document.querySelectorAll('.input-toggle-btn').forEach(btn => btn.style.display = 'flex');
                quizTimeRemaining = 60;
                quizStreak = 0;
            }

            quizQuestions = data.questions;
            quizCurrentQuestionIndex = 0;
            quizIsGameActive = true;
            quizIsAnswerLocked = false;

            // Reset stats
            gameStats = {
                correct: 0,
                wrong: 0,
                skips: 0,
                streakCount: 0,
                bestStreak: 0
            };
            currentStreakLevel = 0;

            quizElements.totalQuestions.textContent = quizQuestions.length;

            // Reset Score Displays
            updateScoreDisplay(); // Will handle hiding/showing p1/p2 containers
            updateQuizTimerDisplay(true); // Reset timer UI to 100% instantly
            if (inputMode === 'gamepad') {
                showQuizScreen('binding');

                // Update binding text based on mode
                const statusText = document.getElementById('binding-status-text');
                if (statusText) {
                    statusText.textContent = quizPlayerCount > 1 ? "Waiting for Player 1..." : "Press any button to start...";
                    statusText.style.color = "white"; // Reset color

                    // Cancel button stays visible to allow going back
                    const cancelBtn = document.getElementById('binding-cancel-btn');
                    if (cancelBtn) cancelBtn.style.display = 'inline-block';
                }

                // Tell backend to start listening
                if (socket && socket.connected) {
                    socket.emit('start_binding', { player_count: quizPlayerCount });
                }
            } else {
                // Mouse Mode: Show countdown screen directly
                showQuizScreen('countdown');
                runCountdown();
            }
        } else {
            console.error('Quiz data load failed');
        }
    } catch (error) {
        console.error('Failed to start quiz:', error);
    }
}

function runCountdown() {
    const countdownEl = document.getElementById('countdown-number');
    let count = 3;
    countdownEl.textContent = count;
    countdownEl.className = 'countdown-number countdown-pop';

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count;
            countdownEl.className = 'countdown-number';
            // Trigger reflow for animation restart
            void countdownEl.offsetWidth;
            countdownEl.className = 'countdown-number countdown-pop';
        } else if (count === 0) {
            countdownEl.textContent = 'GO!';
            countdownEl.className = 'countdown-number countdown-go';
            // Transition to game after 750ms
            setTimeout(() => {
                clearInterval(countdownInterval);
                quizIsGameActive = true;
                showQuizScreen('game');
                displayQuizQuestion();
                startQuizTimer();
            }, 750);
        }
    }, 750);
}

function startQuizTimer() {
    updateQuizTimerDisplay();
    updateScoreDisplay(); // Refresh UI state

    quizTimerInterval = setInterval(() => {
        if (!quizIsGameActive) return;

        // Shared Timer Logic for both modes
        if (quizTimeRemaining > 0) {
            quizTimeRemaining--;
            updateQuizTimerDisplay();
        } else {
            endQuiz();
        }

        // Legacy: if we want individual timers for something else, we can keep them, 
        // but user requested a shared top timer.
    }, 1000);
}

function updateQuizTimerDisplay(instant = false) {
    // SHARED TIMER DISPLAY (For both 1P and 2P)
    const minutes = Math.floor(quizTimeRemaining / 60);
    const seconds = Math.floor(quizTimeRemaining % 60);
    quizElements.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (instant) {
        quizElements.timerFill.style.transition = 'none';
    }

    // Update timer bar
    const percentage = Math.max(0, Math.min(100, (quizTimeRemaining / 60) * 100));
    quizElements.timerFill.style.width = `${percentage}%`;
    
    if (instant) {
        // Force reflow
        void quizElements.timerFill.offsetWidth;
        quizElements.timerFill.style.transition = '';
    }

    // Change color when low (under 30 seconds)
    if (quizTimeRemaining <= 30) {
        quizElements.timerFill.classList.add('low');
    } else {
        quizElements.timerFill.classList.remove('low');
    }

    // Hide individual player timers if they exist
    ['p1', 'p2'].forEach(p => {
        const el = document.getElementById(`${p}-timer`);
        if (el) el.style.display = 'none';
    });
}

function applyQuizPenalty(seconds, playerIndex = 1) {
    // Always subtract from SHARED timer
    quizTimeRemaining = Math.max(0, quizTimeRemaining - seconds);
    updateQuizTimerDisplay();

    if (quizPlayerCount > 1) {
        showQuizFeedback(`-${seconds}s`, 'penalty', playerIndex);
    } else {
        showQuizFeedback(`-${seconds} seconds!`, 'penalty');
    }
}

function updateScoreDisplay() {
    if (quizPlayerCount > 1) {
        // 2-Player UI
        document.getElementById('p1-score-container').classList.remove('hidden');
        document.getElementById('p2-score-container').classList.remove('hidden');
        document.getElementById('single-player-score-container').classList.add('hidden');

        document.getElementById('p1-score-val').textContent = quizScores.p1;
        document.getElementById('p2-score-val').textContent = quizScores.p2;
    } else {
        // 1-Player UI
        document.getElementById('p1-score-container').classList.add('hidden');
        document.getElementById('p2-score-container').classList.add('hidden');
        document.getElementById('single-player-score-container').classList.remove('hidden');

        quizElements.score.textContent = quizScore;
    }
}

function displayQuizQuestion() {
    if (quizCurrentQuestionIndex >= quizQuestions.length) {
        // End of quiz
        endQuiz();
        return;
    }

    // Reset Locks for 2-Player
    quizLocks = { p1: false, p2: false };
    document.querySelectorAll('.lock-overlay').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.lockout-bar').forEach(el => el.classList.add('hidden')); // Clear bars
    document.querySelectorAll('.player-score-container').forEach(el => el.classList.remove('locked', 'active-turn'));

    // Update Scores
    updateScoreDisplay();

    const question = quizQuestions[quizCurrentQuestionIndex];
    quizElements.questionNum.textContent = quizCurrentQuestionIndex + 1;
    quizElements.questionText.textContent = question.question;

    // Clear previous answers
    quizElements.answersContainer.innerHTML = '';
    quizElements.feedback.textContent = '';
    quizElements.feedback.className = 'quiz-feedback';

    // Reapply diamond layout if in gamepad mode
    if (inputMode === 'gamepad') {
        quizElements.answersContainer.classList.add('diamond-layout');
    } else {
        quizElements.answersContainer.classList.remove('diamond-layout');
    }

    // Hide skip button (will fade in after 2 seconds)
    const skipBtn = document.getElementById('quiz-skip-btn');
    if (skipBtn) {
        skipBtn.classList.remove('skip-fade-in');
        skipBtn.classList.add('skip-hidden');
    }

    // Lock answers during delay
    quizIsAnswerLocked = true;

    // Reset Steal UI and Timer
    clearInterval(stealTimerInterval);
    if (quizElements.stealIndicator) quizElements.stealIndicator.classList.add('hidden');


    // Record when question was displayed for timing tracking
    questionDisplayTime = Date.now();

    // Create answer buttons with letter prefixes (hidden initially)
    const letters = ['A', 'B', 'C', 'D'];

    question.answers.forEach((answer, index) => {
        let label = letters[index];
        let colorClass = '';

        // Custom Gamepad Mapping:
        // Top(0): X (Blue)
        // Right(1): A (Red)
        // Bottom(2): B (Yellow)
        // Left(3): Y (Green)
        if (inputMode === 'gamepad') {
            if (index === 0) { label = 'X'; colorClass = 'blue'; }
            if (index === 1) { label = 'A'; colorClass = 'red'; }
            if (index === 2) { label = 'B'; colorClass = 'yellow'; }
            if (index === 3) { label = 'Y'; colorClass = 'green'; }
        }

        const btn = document.createElement('button');
        btn.className = 'quiz-answer-btn answer-hidden';
        btn.innerHTML = `<span class="answer-letter ${colorClass}">${label}</span> ${answer}`;
        btn.addEventListener('click', () => selectQuizAnswer(index, 1));
        quizElements.answersContainer.appendChild(btn);
    });

    // After 1 second, start fade in AND unlock (reduced delay)
    setTimeout(() => {
        const buttons = quizElements.answersContainer.querySelectorAll('.quiz-answer-btn');
        buttons.forEach(btn => {
            btn.classList.remove('answer-hidden');
            btn.classList.add('answer-fade-in');
        });

        quizIsAnswerLocked = false;
        const skipBtn = document.getElementById('quiz-skip-btn');
        if (skipBtn) {
            skipBtn.classList.remove('skip-hidden');
            skipBtn.classList.add('skip-fade-in');
        }
    }, 1000);
}

async function selectQuizAnswer(answerIndex, playerIndex = 1) {
    const pKey = 'p' + playerIndex;

    // Checks
    if (!quizIsGameActive) return;
    if (quizPlayerCount > 1) {
        if (quizLocks[pKey]) return; // This player is locked
        if (quizIsAnswerLocked) return; // Game is transitioning
    } else {
        if (quizIsAnswerLocked) return;
    }

    // In 1P mode, lock immediately. In 2P, we wait for result to lock specific player or game.
    if (quizPlayerCount === 1) quizIsAnswerLocked = true;

    // Disable all buttons visual feedback if 1P? No, keep it dynamic.
    const buttons = quizElements.answersContainer.querySelectorAll('.quiz-answer-btn');

    try {
        // Calculate time to answer
        const timeToAnswer = Date.now() - questionDisplayTime;

        const response = await fetch('/api/quiz/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: quizSessionId,
                question_index: quizCurrentQuestionIndex,
                answer_index: answerIndex,
                player: playerIndex,
                time_ms: timeToAnswer,
                streak_count: quizStreak,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (data.correct) {
            // ANSWER CORRECT
            // Lock game immediately
            quizIsAnswerLocked = true;

            // Highlight Correct Button
            if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');

            // Play Sound
            soundRight.currentTime = 0;
            soundRight.play().catch(() => { });

            // Update Score
            if (quizPlayerCount > 1) {
                quizScores[pKey]++;

                // TIME BONUS for 2P
                quizTimeRemaining = Math.min(quizTimeRemaining + 2, 120);
                updateQuizTimerDisplay();

                updateStreak(true, playerIndex);

                updateScoreDisplay();

                // Highlight winner box
                const pContainer = document.getElementById(pKey + '-score-container');
                if (pContainer) pContainer.classList.add('active-turn');
                showQuizFeedback(`+1 Point!`, 'correct', playerIndex);
            } else {
                // 1P Logic
                const streakBonus = quizStreak >= 2 ? Math.min(quizStreak - 1, 5) : 0;
                const pointsEarned = 10 + streakBonus;
                quizScore += pointsEarned;
                quizElements.score.textContent = quizScore;
                showFloatingScore(pointsEarned);
                quizTimeRemaining = Math.min(quizTimeRemaining + 2, 120);
                updateQuizTimerDisplay();
                showQuizFeedback('Correct! +2 seconds', 'correct');
                updateStreak(true);
            }

            // Next Question Delay
            setTimeout(() => {
                if (quizIsGameActive) {
                    quizCurrentQuestionIndex++;
                    quizIsAnswerLocked = false;
                    displayQuizQuestion();
                }
            }, 1000);

        } else {
            // ANSWER WRONG
            if (quizPlayerCount > 1) {
                // Lock THIS player
                quizLocks[pKey] = true;

                // NO TIME PENALTY for 2P as requested (Locked timer remains)
                updateStreak(false, playerIndex);

                const pOverlay = document.getElementById(pKey + '-lock-overlay');
                const pContainer = document.getElementById(pKey + '-score-container');
                const pLockBar = document.getElementById(pKey + '-lock-bar'); // New Bar

                if (pOverlay) pOverlay.classList.remove('hidden');
                if (pLockBar) pLockBar.classList.remove('hidden'); // Show Bar
                if (pContainer) pContainer.classList.add('locked');

                // Visual feedback
                if (buttons[answerIndex]) buttons[answerIndex].classList.add('wrong');

                // Check if BOTH are locked
                if (quizLocks.p1 && quizLocks.p2) {
                    showQuizFeedback("Both Players Locked! Moving on...", 'penalty');
                    quizIsAnswerLocked = true; // Stop inputs

                    // Reveal correct answer
                    if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');

                    setTimeout(() => {
                        if (quizIsGameActive) {
                            quizCurrentQuestionIndex++;
                            quizIsAnswerLocked = false;
                            displayQuizQuestion();
                        }
                    }, 1500);
                } else {
                    // Just this player locked
                    // Just this player locked
                    showQuizFeedback(`LOCKED (3s)!`, 'penalty', playerIndex);

                    const currentQIndex = quizCurrentQuestionIndex;

                    // Initialize Lock Visual (Countdown)
                    if (pOverlay) {
                        pOverlay.innerHTML = `<div class="lock-countdown">3</div>`;
                    }

                    // Countdown Timer (Logic + sync check)
                    let lockTime = 3000; // ms
                    const intervalStep = 100;
                    const lockInterval = setInterval(() => {
                        if (!quizIsGameActive || quizCurrentQuestionIndex !== currentQIndex) {
                            clearInterval(lockInterval);
                            return;
                        }

                        lockTime -= intervalStep;

                        // Update Countdown Text
                        if (pOverlay) {
                            const seconds = Math.ceil(lockTime / 1000);
                            const cntEl = pOverlay.querySelector('.lock-countdown');
                            if (cntEl) cntEl.textContent = Math.max(1, seconds);
                        }

                        if (lockTime <= 0) {
                            clearInterval(lockInterval);
                            quizLocks[pKey] = false;
                            if (pOverlay) pOverlay.classList.add('hidden');
                            if (pLockBar) pLockBar.classList.add('hidden'); // Hide Bar
                            if (pContainer) pContainer.classList.remove('locked');
                        }
                    }, intervalStep);
                }

            } else {
                // 1P Logic (Penalty)
                gameStats.wrong++;
                showQuizFeedback('Wrong! -5 seconds penalty', 'penalty');
                applyQuizPenalty(5);
                updateStreak(false);

                if (buttons[answerIndex]) buttons[answerIndex].classList.add('wrong');
                if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');

                quizIsAnswerLocked = true;
                setTimeout(() => {
                    if (quizIsGameActive) {
                        quizCurrentQuestionIndex++;
                        quizIsAnswerLocked = false;
                        displayQuizQuestion();
                    }
                }, 800);
            }
        }

    } catch (error) {
        console.error('Failed to check answer:', error);
        quizIsAnswerLocked = false;
    }
}

function showFloatingScore(points) {
    const floatingScore = document.getElementById('floating-score');
    if (floatingScore) {
        floatingScore.textContent = `+${points}`;
        floatingScore.classList.remove('animate');
        void floatingScore.offsetWidth; // Force reflow
        floatingScore.classList.add('animate');
    }
}

function showQuizFeedback(message, type, playerIndex = null) {
    // If playerIndex provided and valid, show there
    if (quizPlayerCount > 1 && playerIndex) {
        const pKey = 'p' + playerIndex;
        const el = document.getElementById(`${pKey}-feedback`);
        if (el) {
            el.textContent = message;
            el.className = `player-feedback ${type}`;
            // Clear after delay
            setTimeout(() => {
                el.textContent = '';
                el.className = 'player-feedback';
            }, 2000);
        }
    } else {
        // Global feedback (1P or fallback)
        quizElements.feedback.textContent = message;
        quizElements.feedback.className = `quiz-feedback ${type}`;
    }
}

function resetStreak() {
    quizStreak = 0;
    streakTimeRemaining = STREAK_EXPIRY_TIME;
    clearTimeout(streakTimerTimeout);
    clearInterval(streakExpiryInterval);
    streakTimerTimeout = null;
    streakExpiryInterval = null;

    const indicator = document.getElementById('streak-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
        indicator.classList.remove('streak-pop');
    }
}

function getStreakText(streak) {
    if (streak > gameStats.bestStreak) {
        gameStats.bestStreak = streak;
    }

    // Count distinct streaks (3 or more)
    // If we just hit 3, count it.
    if (streak >= 3 && streak > currentStreakLevel) {
        // Determine if this is a "new" streak event or just continuation
        // For simplicity, let's just count every time we cross the threshold of 3 from 2
        if (streak === 3) {
            gameStats.streakCount++;
        }
    }
    currentStreakLevel = streak;

    if (streak >= 7) return 'PARAGOD!';
    if (streak >= 6) return 'ULTRASTREAK!';
    if (streak >= 5) return 'Megastreak!';
    if (streak >= 4) return 'On Fire!';
    return 'Streak!';
}

function getStreakLevel(streak) {
    if (streak >= 7) return 'paragod';
    if (streak >= 6) return 'ultra';
    if (streak >= 5) return 'mega';
    if (streak >= 4) return 'fire';
    return 'basic';
}

function updateStreak(correct, playerIndex = 1) {
    if (quizPlayerCount > 1) {
        // 2-Player Streak Logic
        const pKey = 'p' + playerIndex;
        if (correct) {
            quizStreaks[pKey]++;
        } else {
            quizStreaks[pKey] = 0;
        }
        // Update UI handled by updateScoreDisplay() called in selectQuizAnswer
    } else {
        // 1-Player Standard Logic
        if (correct) {
            quizStreak++;
            gameStats.correct++;

            // Track best streak
            if (quizStreak > gameStats.bestStreak) {
                gameStats.bestStreak = quizStreak;
            }

            // Track streak occurrences (simple approach: count when we hit 3)
            if (quizStreak === 3) {
                gameStats.streakCount++;
            }

            // Only show indicator at streak of 3 or more
            if (quizStreak >= 3) {
                const indicator = document.getElementById('streak-indicator');
                const streakText = document.getElementById('streak-text');
                if (indicator && streakText) {
                    // Update text
                    streakText.textContent = getStreakText(quizStreak);

                    // Update visual level
                    indicator.className = `streak-indicator streak-${getStreakLevel(quizStreak)}`;

                    // Trigger pop animation
                    indicator.classList.remove('streak-pop');
                    void indicator.offsetWidth; // Force reflow
                    indicator.classList.add('streak-pop');

                    // Reset and start the expiry timer
                    startStreakTimer();
                }
            }
        } else {
            // Wrong answer or skip breaks streak
            resetStreak();
        }
    }
}

function startStreakTimer() {
    // Clear existing timers
    clearTimeout(streakTimerTimeout);
    clearInterval(streakExpiryInterval);

    streakTimeRemaining = STREAK_EXPIRY_TIME;
    const ringProgress = document.getElementById('streak-ring-progress');
    const circumference = 2 * Math.PI * 16; // r=16 from the SVG

    // Set initial full circle
    if (ringProgress) {
        ringProgress.style.strokeDasharray = circumference;
        ringProgress.style.strokeDashoffset = 0;
    }

    // Update ring every 50ms for smooth animation
    streakExpiryInterval = setInterval(() => {
        streakTimeRemaining -= 50;

        if (ringProgress) {
            const progress = streakTimeRemaining / STREAK_EXPIRY_TIME;
            const offset = circumference * (1 - progress);
            ringProgress.style.strokeDashoffset = offset;
        }

        if (streakTimeRemaining <= 0) {
            resetStreak();
        }
    }, 50);
}

async function skipQuestion(playerIndex = 1) {
    if (!quizIsGameActive || quizIsAnswerLocked) return;

    // 1-PLAYER MODE
    if (quizPlayerCount === 1) {
        quizIsAnswerLocked = true;
        // Apply 1 second penalty
        applyQuizPenalty(1);
        showQuizFeedback('Skipped! -1 second', 'penalty');
        gameStats.skips++;
        updateStreak(false);

        // Track server SKIP
        trackSkipOnServer(playerIndex);

        setTimeout(() => {
            if (quizIsGameActive) {
                quizCurrentQuestionIndex++;
                quizIsAnswerLocked = false;
                displayQuizQuestion();
            }
        }, 500);
        return;
    }

    // 2-PLAYER MODE (STEAL MECHANIC)
    const pKey = 'p' + playerIndex;
    if (quizLocks[pKey]) return; // Already locked

    // Lock THIS player (the one who skipped)
    quizLocks[pKey] = true;
    updateStreak(false, playerIndex); // Break their streak

    // Visuals for Skipper
    const pContainer = document.getElementById(pKey + '-score-container');
    const pOverlay = document.getElementById(pKey + '-lock-overlay');
    const pLockBar = document.getElementById(pKey + '-lock-bar');

    if (pOverlay) {
        pOverlay.innerHTML = '<div class="lock-msg">SKIPPED</div>';
        pOverlay.classList.remove('hidden');
    }
    if (pLockBar) pLockBar.classList.remove('hidden');
    if (pContainer) pContainer.classList.add('locked');

    // Track stats
    gameStats.skips++; // Global stat (or per player if tracked)

    // Check if BOTH are now locked (e.g. both skipped or one locked one skipped)
    if (quizLocks.p1 && quizLocks.p2) {
        showQuizFeedback("Both Skipped/Locked! Moving on...", 'penalty');
        quizIsAnswerLocked = true;
        clearInterval(stealTimerInterval); // Stop any steal timer

        setTimeout(() => {
            if (quizIsGameActive) {
                quizCurrentQuestionIndex++;
                quizIsAnswerLocked = false;
                displayQuizQuestion();
            }
        }, 1000);
        return;
    }

    // STEAL OPPORTUNITY for the OTHER player
    // Start Steal Timer (4 seconds)
    startStealTimer(4);
}

function startStealTimer(seconds) {
    // Clear any existing steal timer
    clearInterval(stealTimerInterval);

    const stealEl = quizElements.stealIndicator;
    const stealText = quizElements.stealText;
    const stealRing = quizElements.stealRing;

    if (stealEl) {
        stealEl.classList.remove('hidden');
        // Reset animation
        if (stealRing) {
            stealRing.style.transition = 'none';
            stealRing.style.strokeDasharray = '100';
            stealRing.style.strokeDashoffset = '0';
            // Force reflow
            void stealRing.offsetWidth;
            stealRing.style.transition = 'stroke-dashoffset 1s linear';
        }
    }

    if (stealText) stealText.innerHTML = `STEAL!<br><span style="font-size:0.8em">${seconds}</span>`;

    let time = seconds;
    const maxTime = seconds;

    stealTimerInterval = setInterval(() => {
        time--;

        // Update Visuals
        if (stealText) stealText.innerHTML = `STEAL!<br><span style="font-size:0.8em">${time}</span>`;
        if (stealRing) {
            const invertedOffset = ((maxTime - time) / maxTime) * 100;
            stealRing.style.strokeDashoffset = invertedOffset;
        }

        if (time <= 0 || !quizIsGameActive) {
            clearInterval(stealTimerInterval);
            if (stealEl) stealEl.classList.add('hidden');

            // Time up! Moving on
            if (quizIsGameActive) {
                showQuizFeedback("Time's up!", 'penalty');
                setTimeout(() => {
                    quizCurrentQuestionIndex++;
                    quizIsAnswerLocked = false;
                    displayQuizQuestion();
                }, 500);
            }
        }
    }, 1000);
}

async function trackSkipOnServer(playerIndex = 1) {
    try {
        const timeToAnswer = Date.now() - questionDisplayTime;
        const question = quizQuestions[quizCurrentQuestionIndex];
        await fetch('/api/quiz/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: quizSessionId,
                player: playerIndex,
                question: question.question,
                question_index: quizCurrentQuestionIndex,
                time_ms: timeToAnswer,
                streak_count: quizStreak, // Using global, but tracking is somewhat legacy
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Failed to track skip:', error);
    }
}

function stopQuizAttempt() {
    console.log('[StopHold] stopQuizAttempt() CALLED');
    // Check if in calibration mode
    if (calibrationMode) {
        endCalibration();
        return;
    }
    // End the quiz immediately
    endQuiz();
}

function pressKey(letter) {
    const input = document.getElementById('quiz-player-name');
    if (input.value.length < 10) {
        input.value += letter;
    }
}

function pressBackspace() {
    const input = document.getElementById('quiz-player-name');
    input.value = input.value.slice(0, -1);
}

function endQuiz() {
    quizIsGameActive = false;
    clearInterval(quizTimerInterval);

    // End gamepad session if active
    if (socket && socket.connected) {
        socket.emit('end_session');
    }

    if (quizPlayerCount > 1) {
        // 2-Player End Screen
        let winnerText = "It's a Tie!";
        let winnerColor = "white";

        if (quizScores.p1 > quizScores.p2) {
            winnerText = "PLAYER 1 WINS!";
            winnerColor = "#2196F3"; // Blue
        } else if (quizScores.p2 > quizScores.p1) {
            winnerText = "PLAYER 2 WINS!";
            winnerColor = "#F44336"; // Red
        }

        // Hide Leaderboard & Init Elements that might confuse
        document.getElementById('quiz-end-leaderboard').classList.add('hidden');
        quizElements.nameEntry.classList.add('hidden');

        // Display Winner
        document.querySelector('.quiz-score-label').textContent = 'RESULT';
        quizElements.finalScore.textContent = winnerText;
        quizElements.finalScore.style.color = winnerColor;
        quizElements.finalScore.style.textShadow = "0 0 20px " + winnerColor;

        showQuizScreen('end');

    } else {
        // 1-Player Standard Logic
        document.querySelector('.quiz-score-label').textContent = 'Your Score';
        document.getElementById('quiz-end-leaderboard').classList.remove('hidden');
        quizElements.finalScore.style.color = "";
        quizElements.finalScore.style.textShadow = "";

        quizElements.finalScore.textContent = quizScore;
        showQuizScreen('end');

        checkQuizTopScore();
    }

    // Update Play Again button text based on input mode
    const playAgainBtn = document.getElementById('quiz-play-again-btn');
    if (playAgainBtn) {
        playAgainBtn.textContent = inputMode === 'gamepad'
            ? 'Hold START to play again'
            : 'Play Again';
    }

    // Auto-return to start screen after 60 seconds
    let autoReturnSeconds = 60;
    if (playAgainBtn) {
        const baseText = playAgainBtn.textContent;
        endScreenAutoReturnTimer = setInterval(() => {
            autoReturnSeconds--;
            if (autoReturnSeconds <= 0) {
                clearInterval(endScreenAutoReturnTimer);
                endScreenAutoReturnTimer = null;
                showQuizStartScreen();
            } else {
                if (playAgainBtn) {
                    playAgainBtn.textContent = baseText + ` (${autoReturnSeconds}s)`;
                }
            }
        }, 1000);
    }
}
