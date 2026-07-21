import re

def rewrite():
    with open('frontend/js/quiz.js', 'r') as f:
        content = f.read()
    
    # We will replace the state variables
    state_vars = """// State
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
"""
    # Replace the old state vars
    content = re.sub(r'// State.*?let holdProgressInterval = null;', state_vars, content, flags=re.DOTALL)
    
    # Fix resetQuiz
    reset_func = """export function resetQuiz() {
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
}"""
    content = re.sub(r'export function resetQuiz\(\) \{.*?\n\}', reset_func, content, flags=re.DOTALL)
    
    # Fix isQuizLocked
    islocked_func = """export function isQuizLocked() {
  return gameState !== 'IDLE' && gameState !== 'ENDING';
}"""
    content = re.sub(r'export function isQuizLocked\(\) \{.*?\n\}', islocked_func, content, flags=re.DOTALL)
    
    # Fix holds
    holds_func = """function cancelHoldProgress() {
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
}"""
    content = re.sub(r'function cancelHoldProgress\(\) \{.*?function cancelStopHold\(\) \{.*?\n\}', holds_func, content, flags=re.DOTALL)
    
    # Fix runCountdown and startTimer by introducing Game Loop
    loop_funcs = """function gameLoop(timestamp) {
  if (!lastRafTime) lastRafTime = timestamp;
  lastRafTime = timestamp;

  if (gameState === 'COUNTDOWN') {
    const elapsed = timestamp - countdownStartMs;
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
        startGame(timestamp);
      }, 350);
    }
  } 
  else if (gameState === 'ACTIVE') {
    // 1. Timer Logic
    const elapsed = timestamp - quizStartTimeMs;
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
      const holdElapsed = timestamp - holdStartMs;
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
"""
    content = re.sub(r'function runCountdown\(\) \{.*?function startTimer\(\) \{.*?\n\}', loop_funcs, content, flags=re.DOTALL)
    
    # Fix event listener gamepad start down checking classes
    gamepad_start = """  window.addEventListener('app_gamepad_start_down', () => {
    if (gameState === 'IDLE' && document.getElementById('quiz-start-screen').classList.contains('active')) startQuizFlow();
    if (gameState === 'ACTIVE') startStopHold();
  });"""
    content = re.sub(r"  window\.addEventListener\('app_gamepad_start_down'.*?\}\);", gamepad_start, content, flags=re.DOTALL)
    
    # Fix Escape key listener
    escape_listener = """  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (gameState === 'ACTIVE') endQuiz('escape_key_pressed');
      else if (gameState === 'BINDING') cancelBindingFlow();
    }
  });"""
    content = re.sub(r"  window\.addEventListener\('keydown'.*?\}\);", escape_listener, content, flags=re.DOTALL)
    
    # Fix displayQuestion replacing Date.now()
    content = content.replace("questionStartTime = Date.now();", "questionStartTimeMs = performance.now();")
    
    # Fix endQuiz
    end_quiz = """async function endQuiz(reason = 'unknown') {
  if (gameState === 'ENDING') return;
  gameState = 'ENDING';
  
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  endSession(); // Gamepad session
  
  showScreen('quiz-end-screen');"""
    content = re.sub(r"async function endQuiz.*?showScreen\('quiz-end-screen'\);", end_quiz, content, flags=re.DOTALL)
    
    # Fix handleSkip and handleAnswer checks
    content = content.replace("!isGameActive", "gameState !== 'ACTIVE'")
    
    # Fix handleAnswer time taken
    content = content.replace("const timeTaken = Date.now() - questionStartTime;", "const timeTaken = performance.now() - questionStartTimeMs;")
    
    # Fix handleSkip time taken
    content = content.replace("const timeTaken = Date.now() - questionStartTime;", "const timeTaken = performance.now() - questionStartTimeMs;")
    
    # Fix time additions in handleAnswer
    content = content.replace("timeRemaining = Math.min(60, timeRemaining + 2);", "timeAddedMs += 2000;")
    content = content.replace("timeRemaining = Math.max(0, timeRemaining - 5);", "timeAddedMs -= 5000;")
    content = content.replace("timeRemaining = Math.max(0, timeRemaining - 1);", "timeAddedMs -= 1000;")
    
    # Fix goToNextQuestion
    next_q = """function goToNextQuestion(delay, btns = null) {
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
}"""
    content = re.sub(r'function goToNextQuestion.*?\}, delay\);\n\}', next_q, content, flags=re.DOTALL)

    # startQuizFlow gameState
    content = content.replace("showScreen('quiz-binding-screen');", "gameState = 'BINDING';\n      showScreen('quiz-binding-screen');")
    
    with open('frontend/js/quiz.js', 'w') as f:
        f.write(content)

rewrite()
print("Success")
