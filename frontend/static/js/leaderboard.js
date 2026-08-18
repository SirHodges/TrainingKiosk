/* leaderboard.js — Score display, leaderboard rendering, stats tooltips */

async function checkQuizTopScore() {
    try {
        const response = await fetch('/api/leaderboard/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: quizScore })
        });

        const data = await response.json();

        if (data.is_top_score && quizScore > 0) {
            quizElements.nameEntry.classList.remove('hidden');
            quizElements.playerName.value = '';
            quizElements.playerName.focus();
            // Load leaderboard with placeholder for user's score
            loadQuizEndLeaderboardWithPlaceholder();
        } else {
            quizElements.nameEntry.classList.add('hidden');
            loadQuizEndLeaderboard();
        }
    } catch (error) {
        console.error('Failed to check top score:', error);
        quizElements.nameEntry.classList.add('hidden');
        loadQuizEndLeaderboard();
    }
}

function skipNameEntry() {
    // Hide the name entry and just show the regular leaderboard
    quizElements.nameEntry.classList.add('hidden');
    loadQuizEndLeaderboard();
}

async function fetchLeaderboardScores() {
    const response = await fetch('/api/leaderboard/');
    const data = await response.json();
    return data.scores;
}

async function loadQuizEndLeaderboardWithPlaceholder() {
    try {
        const scores = await fetchLeaderboardScores();
        displayQuizScoresWithPlaceholder(scores, quizElements.endScoresList, quizScore);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

function displayQuizScoresWithPlaceholder(scores, container, userScore) {
    container.innerHTML = '';

    // Find where user's score would be inserted
    let insertIndex = scores.findIndex(entry => userScore > entry.score);
    if (insertIndex === -1) insertIndex = scores.length;

    // Create combined list with placeholder
    let displayIndex = 0;
    for (let i = 0; i <= scores.length && displayIndex < 10; i++) {
        if (i === insertIndex) {
            // Insert flashing placeholder row
            const row = document.createElement('div');
            row.className = 'score-row score-placeholder';

            const rank = document.createElement('span');
            rank.className = 'rank';
            rank.textContent = `#${displayIndex + 1}`;

            const name = document.createElement('span');
            name.className = 'name placeholder-name';
            name.textContent = '???';

            const scoreVal = document.createElement('span');
            scoreVal.className = 'score-val';
            scoreVal.textContent = userScore;

            const dateTimeSpan = document.createElement('span');
            dateTimeSpan.className = 'score-datetime';
            dateTimeSpan.innerHTML = '<span class="score-date">NOW</span><span class="score-time"></span>';

            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(scoreVal);
            row.appendChild(dateTimeSpan);
            container.appendChild(row);
            displayIndex++;
        }

        if (i < scores.length && displayIndex < 10) {
            const entry = scores[i];
            const row = document.createElement('div');
            row.className = 'score-row';

            if (entry.stats) {
                row.dataset.hasStats = 'true';
                // Store full stats in a data attribute
                row.dataset.stats = JSON.stringify(entry.stats);

                // Click handler for fixed tooltip
                row.addEventListener('click', function (e) {
                    // Stop propagation to prevent document click from closing it immediately
                    e.stopPropagation();

                    const stats = JSON.parse(this.dataset.stats);
                    showFixedTooltip(this, stats);
                });

                // Add visual cue
                row.style.cursor = 'pointer';
            }

            const rank = document.createElement('span');
            rank.className = 'rank';
            rank.textContent = `#${displayIndex + 1}`;

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = entry.name;

            const scoreVal = document.createElement('span');
            scoreVal.className = 'score-val';
            scoreVal.textContent = entry.score;

            const dateTimeInfo = formatScoreDate(entry.date);
            const dateTimeSpan = document.createElement('span');
            dateTimeSpan.className = 'score-datetime';
            dateTimeSpan.innerHTML = `<span class="score-date">${dateTimeInfo.date}</span><span class="score-time">${dateTimeInfo.time}</span>`;

            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(scoreVal);
            row.appendChild(dateTimeSpan);
            container.appendChild(row);
            displayIndex++;
        }
    }
}

async function submitQuizScore() {
    const name = quizElements.playerName.value.trim().toUpperCase() || 'ANON';

    try {
        // Check for secret NUKE command to clear leaderboard
        if (name === 'NUKE') {
            const response = await fetch('/api/leaderboard/nuke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            quizElements.nameEntry.classList.add('hidden');
            displayQuizScores(data.scores, quizElements.endScoresList);
            displayQuizScores(data.scores, quizElements.sidebarScoresList);
            return;
        }

        const response = await fetch('/api/leaderboard/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score: quizScore,
                name: name,
                stats: gameStats
            })
        });

        const data = await response.json();

        quizElements.nameEntry.classList.add('hidden');
        displayQuizScores(data.scores, quizElements.endScoresList);
        displayQuizScores(data.scores, quizElements.sidebarScoresList);
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
}

async function loadQuizLeaderboard() {
    try {
        const scores = await fetchLeaderboardScores();
        displayQuizScores(scores, quizElements.sidebarScoresList);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

async function loadQuizEndLeaderboard() {
    try {
        const scores = await fetchLeaderboardScores();
        displayQuizScores(scores, quizElements.endScoresList);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

function formatScoreDate(dateStr) {
    if (!dateStr) return { date: '', time: '' };
    try {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateText = `${months[date.getMonth()]} ${date.getDate()}`;
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        const timeText = `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}`;
        return { date: dateText, time: timeText };
    } catch (e) {
        return { date: '', time: '' };
    }
}

function displayQuizScores(scores, container) {
    container.innerHTML = '';

    if (scores.length === 0) {
        container.innerHTML = '<p class="no-scores">No scores yet. Be the first!</p>';
        return;
    }

    scores.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'score-row';

        const rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = `#${index + 1}`;

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = entry.name;

        if (entry.stats) {
            row.dataset.hasStats = 'true';
            row.dataset.stats = JSON.stringify(entry.stats);

            // Hover handler for fixed tooltip
            row.addEventListener('mouseenter', function () {
                const stats = JSON.parse(this.dataset.stats);
                showFixedTooltip(this, stats);
            });

            row.addEventListener('mouseleave', function () {
                hideFixedTooltip();
            });

            // Add visual cue
            row.style.cursor = 'pointer';
        }

        const scoreVal = document.createElement('span');
        scoreVal.className = 'score-val';
        scoreVal.textContent = entry.score;

        const dateTimeInfo = formatScoreDate(entry.date);
        const dateTimeSpan = document.createElement('span');
        dateTimeSpan.className = 'score-datetime';
        dateTimeSpan.innerHTML = `<span class="score-date">${dateTimeInfo.date}</span><span class="score-time">${dateTimeInfo.time}</span>`;

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(scoreVal);
        row.appendChild(dateTimeSpan);
        container.appendChild(row);
    });
}

const fixedTooltip = document.createElement('div');
fixedTooltip.id = 'fixed-quiz-tooltip';
fixedTooltip.className = 'score-tooltip fixed';
document.body.appendChild(fixedTooltip);

function showFixedTooltip(targetElement, stats) {
    const tooltip = document.getElementById('fixed-quiz-tooltip');

    // Populate content
    tooltip.innerHTML = `
                <div class="stat-item"><span class="stat-label">Correct:</span><span class="stat-val correct">+${stats.correct || 0}</span></div>
                <div class="stat-item"><span class="stat-label">Wrong:</span><span class="stat-val wrong">-${stats.wrong || 0}</span></div>
                <div class="stat-item"><span class="stat-label">Skips:</span><span class="stat-val skip">${stats.skips || 0}</span></div>
                <div class="stat-break"></div>
                <div class="stat-item"><span class="stat-label">Best Streak:</span><span class="stat-val streak">${stats.bestStreak || 0}</span></div>
                <div class="stat-break"></div>
                <div class="stat-item"><span class="stat-label">Best Streak:</span><span class="stat-val streak">${stats.bestStreak || 0}</span></div>
                <div class="stat-item"><span class="stat-label">Total Streaks:</span><span class="stat-val">${stats.streakCount || 0}</span></div>
            `;

    // Show and position
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';

    const rect = targetElement.getBoundingClientRect();
    tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
    tooltip.style.left = `${rect.right + 15}px`;
    tooltip.style.transform = 'translateY(-50%)';
}

function hideFixedTooltip() {
    const tooltip = document.getElementById('fixed-quiz-tooltip');
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
}
