// quiz.js - Quiz game module

import { startQuiz as apiStartQuiz, submitAnswer, skipQuestion, checkTopScore, submitScore, getLeaderboard } from './api.js?v=4.4';
import { playRight, playWrong } from './audio.js?v=4.4';
import { registerFocusables, clearFocusables } from './navigation.js?v=4.4';
import { startBinding, endSession } from './gamepad.js?v=4.4';
import { displayScoresWithPlaceholder, loadLeaderboard } from './leaderboard.js?v=4.4';

// State
let quizQuestions = [];
let currentIndex = 0;
let sessionId = null;
let inputMode = 'mouse'; // 'mouse' or 'gamepad'
let playerCount = 1;

// Robust State Machine
let gameState = 'IDLE'; // IDLE, BINDING, COUNTDOWN, ACTIVE, ENDING
let quizDurationMs = 60000;
let quizStartTimeMs = 0;
let timeAddedMs = 0;
let holdStartMs = 0;
let countdownStartMs = 0;
let rafId = null;
let lastRafTime = 0;

let questionStartTimeMs = 0;
let lockoutTimeouts = { 0: null, 1: null };

// Player states
let players;

let streakTimer = null;


export function initQuiz() {
  showScreen('quiz-start-screen');
  setupEventListeners();
  resetQuiz();
}

export function isQuizLocked() {
  return gameState !== 'IDLE' && gameState !== 'ENDING';
}

export function resetQuiz() {
  quizQuestions = [];
  currentIndex = 0;
  sessionId = null;
  gameState = 'IDLE';
  
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  quizStartTimeMs = 0;
  timeAddedMs = 0;
  holdStartMs = 0;
  countdownStartMs = 0;
  
  clearTimeout(streakTimer);
  clearTimeout(lockoutTimeouts[0]);
  clearTimeout(lockoutTimeouts[1]);
  lockoutTimeouts = { 0: null, 1: null };
  
  players = {
    0: { score: 0, streak: 0, bestStreak: 0, stats: { correct: 0, wrong: 0, skips: 0 }, locked: false },
    1: { score: 0, streak: 0, bestStreak: 0, stats: { correct: 0, wrong: 0, skips: 0 }, locked: false }
  };
  
  updateScoreDisplay();
  hideStreak();
  document.getElementById('lock-overlay').classList.remove('active');
}

function showScreen(screenId) {
  document.querySelectorAll('.quiz-screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
  clearFocusables('quiz');
  
  if (screenId === 'quiz-start-screen') {
    registerFocusables('quiz', [
      document.getElementById('btn-mode-1p'),
      document.getElementById('btn-mode-2p'),
      document.getElementById('btn-input-mouse'),
      document.getElementById('btn-input-gamepad'),
      document.getElementById('btn-start-quiz')
    ]);
  } else if (screenId === 'quiz-game-screen') {
    updateFocusForGameScreen();
  }
}

function updateFocusForGameScreen() {
  if (inputMode === 'mouse') {
    const btns = Array.from(document.querySelectorAll('.quiz-answer-btn'));
    btns.push(document.getElementById('btn-skip-q'));
    registerFocusables('quiz', btns);
  } else {
    // In gamepad mode, D-pad is not used for answers (face buttons are used)
    // Only focus skip
    registerFocusables('quiz', [document.getElementById('btn-skip-q')]);
  }
}

let eventsAttached = false;
function setupEventListeners() {
  if (eventsAttached) return;
  eventsAttached = true;
  document.getElementById('btn-start-quiz').onclick = startQuizFlow;
  document.getElementById('btn-cancel-binding').onclick = cancelBindingFlow;
  
  // Start button (click to start)
  const startBtn = document.getElementById('btn-start-quiz');
  // Hold logic removed, handled by onclick
  
  // Stop hold button
  const stopBtn = document.getElementById('btn-stop-quiz');
  stopBtn.addEventListener('mousedown', startStopHold);
  stopBtn.addEventListener('mouseup', cancelStopHold);
  stopBtn.addEventListener('mouseleave', cancelStopHold);
  
  document.getElementById('btn-skip-q').onclick = () => handleSkip(0); // Mouse mode defaults to P1 skip
  
  // Mode selectors
  document.getElementById('btn-mode-1p').onclick = () => setPlayerCount(1);
  document.getElementById('btn-mode-2p').onclick = () => setPlayerCount(2);
  document.getElementById('btn-input-mouse').onclick = () => setInputMode('mouse');
  document.getElementById('btn-input-gamepad').onclick = () => setInputMode('gamepad');
  
  // Gamepad events
  window.addEventListener('app_gamepad_btn', handleGamepadButton);
  window.addEventListener('app_gamepad_start_down', () => {
    if (gameState === 'ACTIVE') startStopHold();
  });
  window.addEventListener('app_gamepad_start_up', () => {
    cancelHoldProgress();
    cancelStopHold();
  });
  window.addEventListener('app_gamepad_binding', handleBindingStatus);
}

function setPlayerCount(count) {
  playerCount = count;
  document.getElementById('btn-mode-1p').classList.toggle('active', count === 1);
  document.getElementById('btn-mode-2p').classList.toggle('active', count === 2);
  
  const mouseBtn = document.getElementById('btn-input-mouse');
  if (count === 2) {
    mouseBtn.disabled = true;
    if (inputMode === 'mouse') {
      setInputMode('gamepad');
    }
  } else {
    mouseBtn.disabled = false;
  }
}

function setInputMode(mode) {
  inputMode = mode;
  document.getElementById('btn-input-mouse').classList.toggle('active', mode === 'mouse');
  document.getElementById('btn-input-gamepad').classList.toggle('active', mode === 'gamepad');
  const startBtnText = document.getElementById('start-btn-text');
  if (startBtnText) startBtnText.innerText = 'START';
  const skipBtnText = document.getElementById('skip-btn-text');
  if (skipBtnText) skipBtnText.innerText = mode === 'mouse' ? 'Skip Question' : 'Skip (RB)';
}

// Start Flow hold logic removed
function cancelHoldProgress() {
  holdStartMs = 0;
  const fill = document.getElementById('start-btn-fill');
  if (fill) fill.style.height = '0%';
}

function startStopHold() {
  if (gameState !== 'ACTIVE') return;
  holdStartMs = performance.now();
}

function cancelStopHold() {
  holdStartMs = 0;
  const fill = document.getElementById('stop-btn-fill');
  if (fill) fill.style.height = '0%';
}

let lastStartQuizFlow = 0;
export async function startQuizFlow() {
  const now = Date.now();
  if (now - lastStartQuizFlow < 1500) return;
  lastStartQuizFlow = now;

  cancelHoldProgress();
  resetQuiz();
  
  const res = await apiStartQuiz();
  if (!res || !res.success) return;
  
  quizQuestions = res.questions;
  sessionId = res.session_id;
    if (inputMode === 'gamepad') {
      gameState = 'BINDING';
      showScreen('quiz-binding-screen');
      document.getElementById('binding-msg').innerHTML = `Waiting for players... (0/${playerCount} connected)<br/><strong>Press ANY button!</strong>`;
      startBinding(playerCount);
  } else {
    runCountdown();
  }
}

function cancelBindingFlow() {
  endSession();
  resetQuiz();
  showScreen('quiz-start-screen');
}

function handleBindingStatus(e) {
  const status = e.detail;
  if (status.ready) {
    runCountdown();
  } else {
    document.getElementById('binding-msg').innerHTML = `Waiting for players... (${status.players_bound}/${status.target} connected)<br/><strong>Press ANY button!</strong>`;
  }
}

function gameLoop() {
  const now = performance.now();
  if (!lastRafTime) lastRafTime = now;
  lastRafTime = now;

  if (gameState === 'COUNTDOWN') {
    const elapsed = now - countdownStartMs;
    let count = 3 - Math.floor(elapsed / 1000);
    const countEl = document.getElementById('countdown-number');
    
    if (count > 0) {
      if (countEl.textContent !== count.toString()) {
        countEl.textContent = count;
        countEl.style.animation = 'none';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            countEl.style.animation = 'popInOut 1s ease-in-out forwards';
          });
        });
      }
    } else if (count <= 0 && countEl.textContent !== 'GO!') {
      countEl.textContent = 'GO!';
      countEl.style.animation = 'none';
      countEl.style.transform = 'scale(1.2)';
      countEl.style.opacity = '1';
      countEl.style.color = 'var(--color-success)';
      setTimeout(() => {
        countEl.style.color = '';
        startGame(now);
      }, 350);
    }
  } 
  else if (gameState === 'ACTIVE') {
    // 1. Timer Logic
    const elapsed = now - quizStartTimeMs;
    const remainingMs = Math.max(0, quizDurationMs + timeAddedMs - elapsed);
    const remainingSec = remainingMs / 1000;
    
    const pct = Math.min(100, (remainingSec / 60) * 100);
    const bar = document.getElementById('quiz-timer-bar');
    bar.style.width = `${pct}%`;
    
    if (remainingSec <= 15) bar.style.backgroundColor = 'var(--color-danger)';
    else if (remainingSec <= 30) bar.style.backgroundColor = 'var(--color-warning)';
    else bar.style.backgroundColor = 'var(--color-success)';
    
    if (remainingMs <= 0) {
      endQuiz('timer_expired');
      return; // Stop processing this frame
    }
    
    // 2. Hold Logic
    if (holdStartMs > 0) {
      const holdElapsed = now - holdStartMs;
      const holdPct = Math.min(100, (holdElapsed / 1000) * 100);
      const fill = document.getElementById('stop-btn-fill');
      if (fill) fill.style.height = `${holdPct}%`;
      
      if (holdPct >= 100) {
        endQuiz('user_aborted_via_hold');
        return;
      }
    }
  }

  // Continue loop if not ending
  if (gameState !== 'ENDING' && gameState !== 'IDLE') {
    rafId = requestAnimationFrame(gameLoop);
  }
}

function runCountdown() {
  gameState = 'COUNTDOWN';
  showScreen('quiz-countdown-screen');
  const countEl = document.getElementById('countdown-number');
  countEl.textContent = '3';
  countEl.style.animation = 'none';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      countEl.style.animation = 'popInOut 1s ease-in-out forwards';
    });
  });
  
  countdownStartMs = performance.now();
  if (!rafId) rafId = requestAnimationFrame(gameLoop);
}

function startGame(timestamp) {
  gameState = 'ACTIVE';
  showScreen('quiz-game-screen');
  
  // Setup UI based on player count
  document.getElementById('p2-score-box').style.display = playerCount === 2 ? 'flex' : 'none';
  document.getElementById('game-score-display').style.display = playerCount === 1 ? 'block' : 'none';
  
  // Setup answers layout
  const answersContainer = document.getElementById('quiz-answers-container');
  if (inputMode === 'gamepad') {
    answersContainer.className = 'diamond-layout';
  } else {
    answersContainer.className = 'quiz-answers';
  }
  
  quizStartTimeMs = timestamp || performance.now();
  displayQuestion();
}

// startTimer is removed, logic is in gameLoop


function displayQuestion() {
  if (currentIndex >= quizQuestions.length) {
    endQuiz('no_more_questions');
    return;
  }
  
  const q = quizQuestions[currentIndex];
  document.getElementById('quiz-question-text').textContent = q.question;
  
  // Record start time for this question
  questionStartTimeMs = performance.now();
  
  const container = document.getElementById('quiz-answers-container');
  container.innerHTML = '';
  
  // Hide answers initially, prevent clicking
  container.style.transition = 'none';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  
  // Gamepad layout: Y (top), B (right), A (bottom), X (left)
  const letters = inputMode === 'gamepad' ? ['Y', 'B', 'A', 'X'] : ['A', 'B', 'C', 'D'];
  const btnClasses = inputMode === 'gamepad' ? ['btn-y', 'btn-b', 'btn-a', 'btn-x'] : [];
  
  q.answers.forEach((ans, idx) => {
    const btn = document.createElement('button');
    btn.className = `quiz-answer-btn ${btnClasses[idx] || ''}`;
    btn.innerHTML = `
      <div class="answer-letter">${letters[idx]}</div>
      <div class="answer-text">${ans}</div>
    `;
    
    if (inputMode === 'mouse') {
      btn.onclick = () => handleAnswer(idx, 0);
    }
    
    container.appendChild(btn);
  });
  
  updateFocusForGameScreen();
  
  // Clear locks
  players[0].locked = false;
  players[1].locked = false;
  document.getElementById('lock-overlay').classList.remove('active');
  
  // Reveal answers rapidly for speed
  setTimeout(() => {
    container.style.transition = 'opacity 0.15s ease-in';
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
  }, 200);
}

function handleGamepadButton(e) {
  if (gameState !== 'ACTIVE') return;
  const { button, player } = e.detail;
  
  // Map diamond buttons to indices (Y=0, B=1, A=2, X=3)
  const map = { 'Y': 0, 'B': 1, 'A': 2, 'X': 3 };
  
  if (button in map) {
    handleAnswer(map[button], player);
  } else if (button === 'RB') {
    handleSkip(player);
  }
}

function goToNextQuestion(delay, btns = null) {
  gameState = 'WAITING_NEXT_QUESTION'; // Pauses timer implicitly? No, we don't want to pause timer.
  // Actually, we want timer to keep running while showing correct answer.
  // We just prevent clicking.
  if (btns) {
    btns.forEach(b => b.classList.add('inactive'));
  }
  
  // Clear any existing lockout timeouts so they don't fire on the next question
  clearTimeout(lockoutTimeouts[0]);
  clearTimeout(lockoutTimeouts[1]);
  
  setTimeout(() => {
    currentIndex++;
    if (gameState !== 'ENDING') gameState = 'ACTIVE';
    displayQuestion();
  }, delay);
}

let lastAnswerTime = 0;
async function handleAnswer(ansIndex, playerIdx) {
  if (gameState !== 'ACTIVE' || players[playerIdx].locked) return;
  
  const now = Date.now();
  if (now - lastAnswerTime < 200) return;
  lastAnswerTime = now;
  
  const p = players[playerIdx];
  const qIdx = currentIndex;
  const timeTaken = performance.now() - questionStartTimeMs;
  
  const res = await submitAnswer(sessionId, qIdx, ansIndex, timeTaken, p.streak);
  if (!res) return;
  
  const btns = document.querySelectorAll('.quiz-answer-btn');
  const btn = btns[ansIndex];
  
  if (res.correct) {
    playRight();
    btn.classList.add('correct');
    
    // Update stats
    p.stats.correct++;
    p.streak++;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
    
    // Show streak
    if (p.streak >= 3) showStreak(p.streak);
    
    // Score logic
    if (playerCount === 1) {
      let pts = 10;
      if (p.streak >= 7) pts += 20;
      else if (p.streak >= 5) pts += 10;
      else if (p.streak >= 3) pts += 5;
      
      p.score += pts;
      timeAddedMs += 2000;
      showFloatingScore(`+${pts}`, btn);
    } else {
      p.score += 1;
      timeAddedMs += 2000;
    }
    
    updateScoreDisplay();
    goToNextQuestion(400, btns);
    
  } else {
    playWrong();
    btn.classList.add('wrong');
    p.stats.wrong++;
    p.streak = 0;
    hideStreak();
    
    if (playerCount === 1) {
      timeAddedMs -= 5000;
      // Show correct answer
      btns[res.correct_index].classList.add('correct');
      goToNextQuestion(1000, btns);
    } else {
      // 2P lockout
      p.locked = true;
      if (players[0].locked && players[1].locked) {
        btns[res.correct_index].classList.add('correct');
        goToNextQuestion(1000, btns);
      } else {
        showLockout(playerIdx);
      }
    }
  }
}

let lastSkipTime = 0;
async function handleSkip(playerIdx) {
  if (gameState !== 'ACTIVE' || players[playerIdx].locked) return;
  
  const now = Date.now();
  if (now - lastSkipTime < 500) return;
  lastSkipTime = now;
  
  const p = players[playerIdx];
  p.stats.skips++;
  const timeTaken = performance.now() - questionStartTimeMs;
  
  await skipQuestion(sessionId, currentIndex, timeTaken, p.streak);
  
  if (playerCount === 1) {
    timeAddedMs -= 1000;
    goToNextQuestion(0);
  } else {
    p.locked = true;
    showLockout(playerIdx);
  }
}

function showFloatingScore(text, element) {
  const rect = element.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'floating-score';
  el.textContent = text;
  el.style.left = `${rect.left + rect.width/2}px`;
  el.style.top = `${rect.top}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function updateScoreDisplay() {
  if (playerCount === 1) {
    document.getElementById('p1-score-val-single').textContent = players[0].score;
  } else {
    document.getElementById('p1-score-val').textContent = players[0].score;
    document.getElementById('p2-score-val').textContent = players[1].score;
  }
}

function showStreak(count) {
  const ind = document.getElementById('streak-indicator');
  const ring = document.getElementById('streak-ring');
  const txt = document.getElementById('streak-text');
  
  ind.classList.add('active');
  ring.className = 'streak-ring'; // reset
  
  if (count >= 7) { ring.classList.add('streak-7'); txt.textContent = 'PARAGOD!'; txt.style.color = 'var(--streak-ultra)'; }
  else if (count >= 6) { ring.classList.add('streak-6'); txt.textContent = 'ULTRASTREAK!'; txt.style.color = 'var(--streak-ultra)'; }
  else if (count >= 5) { ring.classList.add('streak-5'); txt.textContent = 'Megastreak!'; txt.style.color = 'var(--streak-mega)'; }
  else if (count >= 4) { ring.classList.add('streak-4'); txt.textContent = 'On Fire!'; txt.style.color = 'var(--streak-fire)'; }
  else { ring.classList.add('streak-3'); txt.textContent = 'Streak!'; txt.style.color = 'var(--streak-basic)'; }
  
  clearTimeout(streakTimer);
  streakTimer = setTimeout(hideStreak, 5000);
}

function hideStreak() {
  document.getElementById('streak-indicator').classList.remove('active');
}

function showLockout(playerIdx) {
  const containers = document.querySelectorAll('.player-score-container');
  if (containers[playerIdx]) {
    containers[playerIdx].classList.add('locked');
  }
  
  clearTimeout(lockoutTimeouts[playerIdx]);
  lockoutTimeouts[playerIdx] = setTimeout(() => {
    if (containers[playerIdx]) {
      containers[playerIdx].classList.remove('locked');
    }
    players[playerIdx].locked = false;
  }, 3000);
}

async function endQuiz(reason = 'unknown') {
  if (gameState === 'ENDING') return;
  gameState = 'ENDING';
  
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  endSession(); // Gamepad session
  
  showScreen('quiz-end-screen');
  
  // Debug output
  const debugMsg = document.createElement('div');
  debugMsg.style.color = 'yellow';
  debugMsg.style.fontSize = '12px';
  debugMsg.style.marginTop = '10px';
  debugMsg.textContent = `Debug: Game ended by ${reason}`;
  const endContainer = document.getElementById('quiz-end-screen');
  const debugString = `Debug: Game ended by ${reason}. Qs: ${quizQuestions ? quizQuestions.length : 'undef'}, Idx: ${currentIndex}`;
  if (endContainer && !document.getElementById('debug-end-reason')) {
    debugMsg.id = 'debug-end-reason';
    debugMsg.textContent = debugString;
    endContainer.appendChild(debugMsg);
  } else if (document.getElementById('debug-end-reason')) {
    document.getElementById('debug-end-reason').textContent = debugString;
  }
  
  const finalScore = players[0].score;
  const finalStats = {
    correct: players[0].stats.correct,
    wrong: players[0].stats.wrong,
    skips: players[0].stats.skips,
    best_streak: players[0].bestStreak
  };
  
  document.getElementById('final-score-val').textContent = finalScore;
  
  if (playerCount === 1) {
    // Load leaderboard immediately so user can see it
    await loadLeaderboard('end-leaderboard');
    
    const res = await checkTopScore(finalScore);
    if (res && res.is_top_score) {
      document.getElementById('name-entry-section').style.display = 'block';
      document.getElementById('end-leaderboard').style.display = 'none';
      setupVirtualKeyboard(finalScore, finalStats);
    } else {
      document.getElementById('name-entry-section').style.display = 'none';
      setTimeout(resetToStart, 10000);
    }
  } else {
    document.getElementById('name-entry-section').style.display = 'none';
    const winner = players[0].score > players[1].score ? 'PLAYER 1 WINS!' : (players[1].score > players[0].score ? 'PLAYER 2 WINS!' : 'TIE!');
    document.getElementById('final-score-val').textContent = winner;
    await loadLeaderboard('end-leaderboard');
    setTimeout(resetToStart, 10000);
  }
}

function setupVirtualKeyboard(score, stats) {
  const input = document.getElementById('name-input');
  input.textContent = '';
  
  const keys = document.querySelectorAll('.vk-key');
  keys.forEach(k => {
    k.onclick = () => {
      if (input.textContent.length < 10) {
        input.textContent += k.textContent.trim();
      }
    };
  });
  
  const delBtn = document.getElementById('vk-del');
  delBtn.onclick = () => {
    input.textContent = input.textContent.slice(0, -1);
  };
  
  const submitBtn = document.getElementById('vk-submit');
  submitBtn.onclick = async () => {
    const name = input.textContent.trim() || '???';
    if (name.length === 0) return;
    
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    await submitScore(score, name, stats);
    
    document.getElementById('name-entry-section').style.display = 'none';
    document.getElementById('end-leaderboard').style.display = 'block';
    submitBtn.textContent = 'SUBMIT';
    submitBtn.disabled = false;
    
    await Promise.all([
      loadLeaderboard('end-leaderboard'),
      loadLeaderboard('quiz-sidebar')
    ]);
    setTimeout(resetToStart, 5000);
  };
  
  registerFocusables('vk', Array.from(keys).concat([delBtn, submitBtn]));
}

function resetToStart() {
  resetQuiz();
  showScreen('quiz-start-screen');
}
