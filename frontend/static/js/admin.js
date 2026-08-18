/* admin.js — Admin menu, system update, calibration mode, review mode */

let reviewMode = false;
let reviewQuestions = [];
let reviewCurrentIndex = 0;

let adminMenuOpen = false;

let calibrationMode = false;
let calibrationLevel = 0;
let calibrationQuestions = [];
let calibrationCurrentIndex = 0;
let calibrationCalibratedCount = 0;
let calibrationAnswerLocked = false;
let calibrationState = 'question'; // 'question', 'post_answer', 'flag_reason'
let calibrationPostAnswerTimer = null;

let calibrationFeedbackInputLocked = false; // Grace period lock
let selectedCalibrationLevel = 0; // New state for selection before start

async function loadChangelog() {
    try {
        const response = await fetch('/static/changelog.json?t=' + Date.now());
        const changelogData = await response.json();

        // Update version label
        if (changelogData.length > 0) {
            document.getElementById('version-label').textContent = `v${changelogData[0].version}`;
        }

        const list = document.getElementById('changelog-list');
        list.innerHTML = changelogData.map(item => `
                    <div class="changelog-item">
                        <div class="changelog-header">
                            <span class="changelog-ver">v${item.version}</span>
                            <span class="changelog-date">${item.date}</span>
                        </div>
                        <div class="changelog-desc">${item.desc}</div>
                    </div>
                `).join('');
    } catch (error) {
        console.error('Failed to load changelog:', error);
    }
}

function toggleAdminMenu() {
    const popup = document.getElementById('admin-popup');
    adminMenuOpen = !adminMenuOpen;
    popup.classList.toggle('hidden', !adminMenuOpen);
}

function closeAdminMenu() {
    const popup = document.getElementById('admin-popup');
    adminMenuOpen = false;
    popup.classList.add('hidden');
}

async function triggerUpdate() {
    if (!confirm('This will update from GitHub and reboot the device. Continue?')) {
        return;
    }

    const btn = document.querySelector('.update-action');
    btn.classList.add('loading');
    btn.querySelector('span').textContent = 'Updating...';

    try {
        const response = await fetch('/api/system/update', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            btn.querySelector('span').textContent = 'Rebooting...';
            setTimeout(() => {
                alert('Device is rebooting. Please wait about 30 seconds then refresh the page.');
            }, 1000);
        } else {
            alert(data.error || 'Update failed');
            btn.classList.remove('loading');
            btn.querySelector('span').textContent = 'Update & Reboot';
        }
    } catch (error) {
        alert('Update not available on this device');
        btn.classList.remove('loading');
        btn.querySelector('span').textContent = 'Update & Reboot';
    }
}

function promptResetScores() {
    const password = prompt('Enter admin password to reset all scores:');

    if (password === null) {
        return; // Cancelled
    }

    if (password.toLowerCase() === 'nuke') {
        if (confirm('⚠️ WARNING: This will permanently delete ALL leaderboard scores. Are you absolutely sure?')) {
            resetAllScores();
        }
    } else {
        alert('❌ Incorrect password');
    }
}

async function resetAllScores() {
    try {
        const response = await fetch('/api/leaderboard/nuke', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ All scores have been reset!');
            loadQuizLeaderboard(); // Refresh the leaderboard
            closeAdminMenu();
        } else {
            alert('Failed to reset scores');
        }
    } catch (error) {
        alert('Error resetting scores: ' + error.message);
    }
}

function promptCalibrationPassword() {
    if (confirm('Are you sure you want to enter calibration mode?')) {
        closeAdminMenu();
        showCalibrationLevelScreen();
    }
}

function promptReviewPassword() {
    const password = prompt("Enter review password:");
    if (password === "Review") {
        closeAdminMenu();
        startReviewMode();
    } else if (password !== null) {
        alert("Incorrect password");
    }
}

async function startReviewMode() {
    try {
        console.log('[Review] Starting fetch...');
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/review/start', { method: 'POST' });
        const data = await response.json();
        */
        const data = { success: false, total: 0 };

        if (data.success) {
            if (data.total === 0) {
                alert("No questions are flagged for review!");
                return;
            }

            console.log(`[Review] Starting review with ${data.total} flagged questions`);
            reviewMode = true;
            reviewQuestions = data.questions;
            reviewCurrentIndex = 0;

            // Manually switch UI to quiz mode without calling switchAppMode (which resets state)
            currentAppMode = 'quiz';

            // Update tab active states
            document.querySelectorAll('.app-mode-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.mode === 'quiz');
            });

            // Switch sidebar content
            document.querySelectorAll('.sidebar-mode-content').forEach(content => {
                content.classList.remove('active');
            });
            const quizSidebar = document.getElementById('quiz-sidebar');
            if (quizSidebar) quizSidebar.classList.add('active');

            // Switch main content
            document.querySelectorAll('.app-mode-content').forEach(content => {
                content.classList.remove('active');
            });
            const quizContent = document.getElementById('quiz-content');
            if (quizContent) quizContent.classList.add('active');

            console.log('[Review] Showing first question...');
            showReviewQuestion();
        } else {
            console.error('[Review] Failed to start:', data.error);
            alert('Failed to start review mode');
        }
    } catch (error) {
        console.error('[Review] Exception:', error);
        console.error('[Review] Stack:', error.stack);
        alert('Error starting review mode: ' + error.message);
    }
}

function showReviewQuestion() {
    if (reviewCurrentIndex >= reviewQuestions.length) {
        alert(`Review complete! Reviewed ${reviewQuestions.length} questions.`);
        endReviewMode();
        return;
    }

    const q = reviewQuestions[reviewCurrentIndex];

    // Update question text with review header
    document.getElementById('quiz-question-text').textContent =
        `[REVIEW ${reviewCurrentIndex + 1}/${reviewQuestions.length}] ${q.question}`;

    // Display answers
    const container = document.getElementById('quiz-answers-container');
    container.innerHTML = '';

    q.answers.forEach((ans, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-answer-btn';
        btn.textContent = ans;
        btn.dataset.index = idx;
        btn.onclick = () => removeReviewFlag(); // All buttons remove flag
        container.appendChild(btn);
    });

    // Show quiz game screen directly
    const quizScreen = document.getElementById('quiz-game-screen');
    if (quizScreen) {
        quizScreen.classList.remove('hidden');
    }

    console.log(`[Review] Showing question ${reviewCurrentIndex + 1}/${reviewQuestions.length}`);
}

async function removeReviewFlag() {
    if (reviewCurrentIndex >= reviewQuestions.length) return;

    try {
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/review/remove_flag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_index: reviewCurrentIndex })
        });
        const data = await response.json();
        */
        const data = { success: true };
        if (data.success) {
            console.log(`[Review] Flag removed from question ${reviewCurrentIndex}`);
            reviewCurrentIndex++;
            showReviewQuestion();
        } else {
            console.error('[Review] Failed to remove flag:', data.error);
        }
    } catch (error) {
        console.error('[Review] Error removing flag:', error);
    }
}

async function deleteReviewQuestion() {
    if (reviewCurrentIndex >= reviewQuestions.length) return;

    const q = reviewQuestions[reviewCurrentIndex];
    if (!confirm(`Delete this question permanently?\n\n"${q.question}"`)) {
        return;
    }

    try {
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/review/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_index: reviewCurrentIndex })
        });
        const data = await response.json();
        */
        const data = { success: true };
        if (data.success) {
            console.log(`[Review] Deleted question ${reviewCurrentIndex}`);
            reviewCurrentIndex++;
            showReviewQuestion();
        } else {
            console.error('[Review] Failed to delete:', data.error);
        }
    } catch (error) {
        console.error('[Review] Error deleting:', error);
    }
}

async function endReviewMode() {
    try {
        // TODO: Not implemented in new backend
        // await fetch('/api/quiz/review/end', { method: 'POST' });
    } catch (error) {
        console.error('[Review] Error ending session:', error);
    }

    reviewMode = false;
    reviewQuestions = [];
    reviewCurrentIndex = 0;

    console.log('[Review] Session ended');
    switchAppMode('skillplayer');
}

function showCalibrationLevelScreen() {
    // Switch to quiz mode first
    switchAppMode('quiz');

    // Show calibration level selector
    document.querySelectorAll('.quiz-screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById('calibration-level-screen').classList.add('active');

    // Load and display question counts per level
    loadCalibrationCounts();

    // Reset selection
    selectCalibrationLevel(0);
}

function selectCalibrationLevel(level) {
    selectedCalibrationLevel = level;

    // Update UI highlights
    document.querySelectorAll('.calibration-level-btn').forEach((btn, index) => {
        if ((index + 1) === level) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    // Enable/Disable Start Button
    const startBtn = document.getElementById('calibration-start-btn');
    if (startBtn) {
        startBtn.disabled = (level === 0);
        if (level > 0) {
            startBtn.classList.remove('disabled');
        } else {
            startBtn.classList.add('disabled');
        }
    }
}

function confirmStartCalibration() {
    if (selectedCalibrationLevel > 0) {
        startCalibration(selectedCalibrationLevel);
    }
}

async function loadCalibrationCounts() {
    try {
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/calibration/counts');
        const data = await response.json();
        */
        const data = { success: false };

        if (data.success) {
            // Update each level button with the count of questions needing calibration
            const buttons = document.querySelectorAll('.calibration-level-btn');
            buttons.forEach((btn, index) => {
                const level = index + 1;
                // Count questions waiting at the previous level
                let needsCalibration = data.counts[level - 1] || 0;

                // Find or create count span
                let countSpan = btn.querySelector('.calibration-count');
                if (!countSpan) {
                    countSpan = document.createElement('span');
                    countSpan.className = 'calibration-count';
                    btn.appendChild(countSpan);
                }
                countSpan.textContent = `(${needsCalibration} questions)`;
            });
        }
    } catch (error) {
        console.error('Failed to load calibration counts:', error);
    }
}

function exitCalibrationLevelScreen() {
    // Return to quiz start screen
    showQuizScreen('start');
}

async function startCalibration(level) {
    resetGameState(); // Ensure clean slate

    try {
        // Force 1-player mode for calibration logic
        quizPlayerCount = 1;

        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/calibration/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: level })
        });
        const data = await response.json();
        */
        const data = { success: false, error: 'Not implemented in new backend' };

        if (!data.success) {
            alert(data.error || 'Failed to start calibration');
            exitCalibrationLevelScreen();
            return;
        }

        // Initialize calibration state
        calibrationMode = true;
        calibrationLevel = level;
        calibrationQuestions = data.questions;
        calibrationCurrentIndex = 0;
        calibrationCalibratedCount = 0;
        calibrationAnswerLocked = false;

        // Update UI
        document.getElementById('calibration-level-display').textContent = level;
        document.getElementById('calibration-total-questions').textContent = calibrationQuestions.length;

        // Apply input mode layout
        const answersContainer = document.getElementById('calibration-answers-container');
        if (inputMode === 'gamepad') {
            answersContainer.classList.add('diamond-layout');

            // Show binding screen for gamepad mode
            document.querySelectorAll('.quiz-screen').forEach(screen => screen.classList.remove('active'));
            document.getElementById('quiz-binding-screen').classList.add('active');

            // Update binding text for calibration
            const statusText = document.getElementById('binding-status-text');
            if (statusText) {
                statusText.textContent = "Press any button to start calibration...";
                statusText.style.color = "white";
            }

            // Tell backend to start listening (1 player for calibration)
            if (socket && socket.connected) {
                socket.emit('start_binding', { player_count: 1 });
            }
        } else {
            answersContainer.classList.remove('diamond-layout');

            // Mouse mode: Go straight to game screen
            document.querySelectorAll('.quiz-screen').forEach(screen => screen.classList.remove('active'));
            document.getElementById('calibration-game-screen').classList.add('active');
            displayCalibrationQuestion();
        }

    } catch (error) {
        console.error('Failed to start calibration:', error);
        alert('Error starting calibration: ' + error.message);
        exitCalibrationLevelScreen();
    }
}

function displayCalibrationQuestion() {
    if (calibrationCurrentIndex >= calibrationQuestions.length) {
        // All questions calibrated
        endCalibration();
        return;
    }

    calibrationAnswerLocked = false;
    calibrationState = 'question';

    // Clear timer and hide bar
    if (calibrationPostAnswerTimer) {
        clearTimeout(calibrationPostAnswerTimer);
        calibrationPostAnswerTimer = null;
    }
    const timerContainer = document.getElementById('calibration-inplace-timer-container');
    if (timerContainer) timerContainer.classList.add('invisible');

    const question = calibrationQuestions[calibrationCurrentIndex];
    document.getElementById('calibration-question-num').textContent = calibrationCurrentIndex + 1;
    document.getElementById('calibration-question-text').textContent = question.question;
    document.getElementById('calibration-calibrated-count').textContent = `Calibrated: ${calibrationCalibratedCount}`;

    // Clear previous answers
    const answersContainer = document.getElementById('calibration-answers-container');
    answersContainer.innerHTML = '';
    document.getElementById('calibration-feedback').textContent = '';
    document.getElementById('calibration-feedback').className = 'quiz-feedback';

    // Reapply diamond layout if in gamepad mode
    if (inputMode === 'gamepad') {
        answersContainer.classList.add('diamond-layout');
    } else {
        answersContainer.classList.remove('diamond-layout');
    }

    // Create answer buttons
    const letters = ['A', 'B', 'C', 'D'];
    question.answers.forEach((answer, index) => {
        let label = letters[index];
        let colorClass = '';

        if (inputMode === 'gamepad') {
            if (index === 0) { label = 'X'; colorClass = 'blue'; }
            if (index === 1) { label = 'Y'; colorClass = 'green'; } // Python 1 = Y
            if (index === 2) { label = 'B'; colorClass = 'yellow'; }
            if (index === 3) { label = 'A'; colorClass = 'red'; }   // Python 3 = A
        }

        const btn = document.createElement('button');
        btn.className = 'quiz-answer-btn';
        btn.innerHTML = `<span class="answer-letter ${colorClass}">${label}</span> ${answer}`;
        btn.addEventListener('click', () => selectCalibrationAnswer(index));
        answersContainer.appendChild(btn);
    });
}

async function selectCalibrationAnswer(answerIndex) {
    if (!calibrationMode || calibrationAnswerLocked) return;

    calibrationAnswerLocked = true;

    const buttons = document.getElementById('calibration-answers-container').querySelectorAll('.quiz-answer-btn');

    try {
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/calibration/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_index: calibrationCurrentIndex,
                answer_index: answerIndex
            })
        });
        const data = await response.json();
        */
        const data = { success: true, correct: false, correct_index: 0 };

        if (data.correct) {
            // Correct answer
            if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');
            // Play sound
            soundRight.currentTime = 0;
            soundRight.play().catch(() => { });
        } else {
            // Wrong answer
            if (buttons[answerIndex]) buttons[answerIndex].classList.add('wrong');
            if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');
        }

        // Result shown (Green/Red)
        // Wait 1s then proceed to next question (Implicit "Just Right")
        setTimeout(() => {
            submitCalibration(null);
        }, 1000);

    } catch (error) {
        console.error('Failed to check calibration answer:', error);
        calibrationAnswerLocked = false;
    }
}

function getGamepadColor(index) {
    if (index === 0) return 'blue';
    if (index === 1) return 'green';
    if (index === 2) return 'yellow';
    if (index === 3) return 'red';
    return '';
}

function markForReview() {
    if (!calibrationMode || calibrationAnswerLocked) return;
    calibrationAnswerLocked = true;

    // Simplified: Directly submit with 'review' flag
    console.log('[Calibration] Marking for review...');

    // Visual feedback?
    const buttons = document.querySelectorAll('#calibration-answers-container .quiz-answer-btn');
    buttons.forEach(btn => btn.classList.add('wrong')); // Turn red temporarily

    setTimeout(() => {
        submitCalibration('review');
    }, 500);
}

async function markPreviousForReview() {
    if (!calibrationMode || calibrationCurrentIndex <= 0) {
        showCalibrationFeedback("Cannot mark previous: First question", "warning");
        return;
    }

    console.log('[Calibration] Marking PREVIOUS for review...');

    // Animate LB button if possible (optional)
    const btn = document.getElementById('calibration-review-prev-btn');
    if (btn) btn.classList.add('active'); // CSS hook? or just simple feedback

    try {
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/calibration/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_index: calibrationCurrentIndex - 1, // PREVIOUS
                flag_type: 'review'
            })
        });
        const data = await response.json();
        */
        const data = { success: true };
        if (data.success) {
            showCalibrationFeedback("Previous Question Marked for Review", "success");
            setTimeout(() => {
                if (btn) btn.classList.remove('active');
                // Clear feedback after 2s
            }, 500);
        }
    } catch (error) {
        console.error('Failed to mark previous:', error);
    }
}

async function submitCalibration(flagType) {
    // If called from post-answer, clear timer
    if (calibrationPostAnswerTimer) {
        clearTimeout(calibrationPostAnswerTimer);
        calibrationPostAnswerTimer = null;
    }

    try {
        // TODO: Not implemented in new backend
        /*
        const response = await fetch('/api/quiz/calibration/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_index: calibrationCurrentIndex,
                flag_type: flagType
            })
        });
        const data = await response.json();
        */
        const data = { success: true };

        if (data.success) {
            calibrationCalibratedCount++;

            // Move to next question
            calibrationCurrentIndex++;
            displayCalibrationQuestion();
        }

    } catch (error) {
        console.error('Failed to submit calibration:', error);
        alert('Error submitting calibration');
        // Try to recover
        displayCalibrationQuestion();
    }
}

function showCalibrationFeedback(message, type) {
    const feedback = document.getElementById('calibration-feedback');
    feedback.textContent = message;
    feedback.className = `quiz-feedback ${type}`;
}

async function endCalibration() {
    try {
        // TODO: Not implemented in new backend
        // await fetch('/api/quiz/calibration/end', { method: 'POST' });
    } catch (error) {
        console.error('Error ending calibration:', error);
    }

    calibrationMode = false;
    calibrationLevel = 0;
    calibrationQuestions = [];
    calibrationCurrentIndex = 0;

    // Show completion message in UI, then redirect
    showCalibrationFeedback(`Calibration complete! ${calibrationCalibratedCount} calibrated.`, "success");
    
    setTimeout(() => {
        // Return to quiz start screen
        showQuizScreen('start');
    }, 2000);
}
