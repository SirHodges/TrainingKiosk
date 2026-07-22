import { MAP_WIDTH, MAP_HEIGHT, latLonToXY, xyToLatLon, calculatePoints, calculateDistance, calculateZoomViewBox } from './geogame_math.js?v=5.5';
import { initCalibration, exitCalibration } from './geogame_calibration.js?v=5.5';
import { startBinding, getGamepadForPlayer } from './gamepad.js?v=5.5';


// ==========================================
// GAME STATE
// ==========================================
let currentState = 'INTRO'; // INTRO, BINDING, COUNTDOWN, GUESSING, SCORING, GAME_OVER
let playerCount = 1;
let inputMode = 'mouse'; // 'mouse' or 'gamepad'
let currentRoundIndex = 0;
let currentLocations = [];
let p1Score = 0;
let p2Score = 0;
let currentZoom = 0;

let timerInterval = null;

// Gamepad Tracking
let p1Pos = { x: MAP_WIDTH/2 - 50, y: MAP_HEIGHT/2 };
let p2Pos = { x: MAP_WIDTH/2 + 50, y: MAP_HEIGHT/2 };
let animationFrameId = null;
let p1HasGuessed = false;
let p2HasGuessed = false;
let p1Guess = null;
let p2Guess = null;
let p1LockedUntil = 0;
let p2LockedUntil = 0;
let p1Eliminated = false;
let p2Eliminated = false;
let p1LockIcon, p2LockIcon;
let p1LockMessage = "Wild Guess!";
let p2LockMessage = "Wild Guess!";
let isTransitioning = false;

// DOM Elements
let container, mapContainer, mapSvg;
let screens = {};
let p1Reticle, p2Reticle;

// ==========================================
// INIT & LIFECYCLE
// ==========================================

export function isGeoGameLocked() {
  return currentState !== 'INTRO' && currentState !== 'GAME_OVER';
}

export function initGeoGame() {
  container = document.getElementById('geogame-mode');
  if (!container) return;
  
  screens = {
    intro: document.getElementById('geogame-intro-screen'),
    binding: document.getElementById('geogame-binding-screen'),
    countdown: document.getElementById('geogame-countdown-screen'),
    game: document.getElementById('geogame-game-screen'),
    calibration: document.getElementById('geogame-calibration-screen')
  };
  
  mapContainer = document.getElementById('geogame-map-container');
  
  // Setup Intro Listeners
  document.getElementById('btn-geogame-1p').addEventListener('click', () => setPlayerCount(1));
  document.getElementById('btn-geogame-2p').addEventListener('click', () => setPlayerCount(2));
  document.getElementById('btn-geogame-mouse').addEventListener('click', () => setInputMode('mouse'));
  document.getElementById('btn-geogame-gamepad').addEventListener('click', () => setInputMode('gamepad'));
  
  const startBtn = document.getElementById('btn-geogame-start-intro');
  startBtn.addEventListener('mousedown', startHoldProgress);
  startBtn.addEventListener('mouseup', cancelHoldProgress);
  startBtn.addEventListener('mouseleave', cancelHoldProgress);
  startBtn.addEventListener('touchstart', startHoldProgress, {passive: true});
  startBtn.addEventListener('touchend', cancelHoldProgress);
  
  document.getElementById('btn-geogame-cancel-binding').addEventListener('click', () => switchScreen('intro'));
  document.getElementById('btn-geogame-restart').addEventListener('click', () => switchScreen('intro'));
  
  const calibBtn = document.getElementById('btn-geogame-calibrate');
  if (calibBtn) calibBtn.addEventListener('click', () => initCalibration(switchScreen));
  const exitCalibBtn = document.getElementById('btn-geogame-exit-calib');
  if (exitCalibBtn) exitCalibBtn.addEventListener('click', exitCalibration);
  
  mapContainer.addEventListener('click', handleMouseClick);
  
  // Gamepad Global Events (from gamepad.js)
  window.addEventListener('app_gamepad_btn', handleGamepadButton);
  window.addEventListener('app_gamepad_binding', handleBindingStatus);
  window.addEventListener('app_gamepad_start_down', () => {
    if (screens.intro.classList.contains('active')) startHoldProgress();
  });
  window.addEventListener('app_gamepad_start_up', () => {
    cancelHoldProgress();
  });
  
  loadMap();
}

export function startGeoGame() {
  switchScreen('intro');
  setPlayerCount(1);
  setInputMode('mouse');
}

function switchScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[screenName]) screens[screenName].classList.add('active');
  currentState = screenName.toUpperCase();
}

// ==========================================
// CONFIGURATION FLOW
// ==========================================

function setPlayerCount(count) {
  playerCount = count;
  document.getElementById('btn-geogame-1p').classList.toggle('active', count === 1);
  document.getElementById('btn-geogame-2p').classList.toggle('active', count === 2);
  
  if (count === 2) {
    setInputMode('gamepad');
    document.getElementById('btn-geogame-mouse').disabled = true;
  } else {
    document.getElementById('btn-geogame-mouse').disabled = false;
  }
}

function setInputMode(mode) {
  inputMode = mode;
  document.getElementById('btn-geogame-mouse').classList.toggle('active', mode === 'mouse');
  document.getElementById('btn-geogame-gamepad').classList.toggle('active', mode === 'gamepad');
  document.getElementById('geogame-start-btn-text').innerText = mode === 'mouse' ? 'CLICK TO START' : 'PRESS ANY BUTTON TO START';
}

function startHoldProgress() {
  if (currentState !== 'INTRO') return;
  beginStartFlow();
}

function cancelHoldProgress() {
  // No-op now since we removed the hold timer
}

function beginStartFlow() {
  if (inputMode === 'gamepad') {
    switchScreen('binding');
    startBinding(playerCount);
  } else {
    startCountdown();
  }
}

function handleBindingStatus(e) {
  if (currentState !== 'BINDING') return;
  const { ready, players_bound, target } = e.detail;
  
  if (players_bound === 0) {
    document.getElementById('geogame-binding-msg').innerText = "Player One, press any button on your controller";
  } else if (players_bound === 1 && target === 2) {
    document.getElementById('geogame-binding-msg').innerText = "Player Two, press any button on your controller";
  }
  
  if (ready) startCountdown();
}

function startCountdown() {
  switchScreen('countdown');
  let count = 3;
  const counter = document.getElementById('geogame-countdown-number');
  counter.innerText = count;
  
  const tick = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(tick);
      startNewGame();
    } else {
      counter.innerText = count;
    }
  }, 1000);
}

// ==========================================
// MAP & RETICLES
// ==========================================

function loadMap() {
  mapContainer.innerHTML = '';
  mapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mapSvg.setAttribute('id', 'ottawa-map-svg');
  mapSvg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  mapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  mapSvg.style.width = '100%';
  mapSvg.style.height = '100%';
  
  const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
  img.setAttribute('href', '/frontend/assets/ottawa_map_high_res.png');
  img.setAttribute('width', MAP_WIDTH);
  img.setAttribute('height', MAP_HEIGHT);
  mapSvg.appendChild(img);
  
  mapContainer.appendChild(mapSvg);
}

function setupReticles() {
  if (p1Reticle) p1Reticle.remove();
  if (p2Reticle) p2Reticle.remove();
  if (p1LockIcon) p1LockIcon.remove();
  if (p2LockIcon) p2LockIcon.remove();
  
  if (inputMode === 'gamepad') {
    p1Reticle = createReticle("#3b82f6");
    p1LockIcon = createLockIcon("#3b82f6");
    mapSvg.appendChild(p1Reticle);
    mapSvg.appendChild(p1LockIcon);
    if (playerCount === 2) {
      p2Reticle = createReticle("#ef4444");
      p2LockIcon = createLockIcon("#ef4444");
      mapSvg.appendChild(p2Reticle);
      mapSvg.appendChild(p2LockIcon);
    }
  }
}

function createLockIcon(color) {
  const svgNS = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(svgNS, "g");
  group.style.display = 'none';
  
  // Background circle (dark translucent)
  const bg = document.createElementNS(svgNS, "circle");
  bg.setAttribute("r", "20");
  bg.setAttribute("fill", "rgba(0,0,0,0.6)");
  group.appendChild(bg);
  
  // The wipe path (pie slice)
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("fill", color || "white");
  path.classList.add('wipe-path'); // to query it later
  group.appendChild(path);
  
  const textLabel = document.createElementNS(svgNS, "text");
  textLabel.setAttribute("font-size", "14");
  textLabel.setAttribute("font-weight", "bold");
  textLabel.setAttribute("text-anchor", "middle");
  textLabel.setAttribute("dominant-baseline", "central");
  textLabel.setAttribute("fill", "white");
  textLabel.setAttribute("y", "0");
  textLabel.textContent = "Wild Guess!";
  textLabel.style.textShadow = "1px 1px 2px black, -1px -1px 2px black";
  
  group.appendChild(textLabel);
  return group;
}

function createReticle(color) {
  const svgNS = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(svgNS, "g");
  
  const c = document.createElementNS(svgNS, "circle");
  c.setAttribute("cx", "0"); c.setAttribute("cy", "0"); c.setAttribute("r", "10");
  c.setAttribute("fill", "none"); c.setAttribute("stroke", color); c.setAttribute("stroke-width", "2");
  g.appendChild(c);
  
  const addLine = (x1, y1, x2, y2) => {
    const l = document.createElementNS(svgNS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", color); l.setAttribute("stroke-width", "2");
    g.appendChild(l);
  };
  addLine("-15", "0", "-5", "0");
  addLine("5", "0", "15", "0");
  addLine("0", "-15", "0", "-5");
  addLine("0", "5", "0", "15");
  
  g.style.display = 'none';
  return g;
}

// ==========================================
// GAME LOOP
// ==========================================

async function startNewGame() {
  switchScreen('game');
  document.getElementById('geogame-end-modal').classList.add('hidden');
  
  p1Score = 0; p2Score = 0;
  currentRoundIndex = 0;
  
  document.getElementById('geogame-score-display').style.display = playerCount === 1 ? 'block' : 'none';
  document.getElementById('geogame-p2-score-box').style.display = playerCount === 2 ? 'flex' : 'none';
  
  updateScoreUI();
  document.getElementById('geogame-status-text').textContent = "Loading locations...";
  
  clearPins();
  resetMapView();
  setupReticles();
  
  try {
    const res = await fetch('/api/geogame/locations');
    const data = await res.json();
    if (data.status === 'success' && data.locations.length > 0) {
      currentLocations = data.locations.slice(0, 5); // 5 rounds
      startRound();
    } else {
      document.getElementById('geogame-status-text').textContent = "Error: No locations found.";
    }
  } catch (e) {
    document.getElementById('geogame-status-text').textContent = "Error fetching game data.";
  }
}

function startRound() {
  if (currentRoundIndex >= currentLocations.length) {
    endGame();
    return;
  }
  
  currentState = 'GUESSING';
  currentZoom = 0;
  p1HasGuessed = false;
  p2HasGuessed = false;
  p1Guess = null;
  p2Guess = null;
  p1LockedUntil = 0; p2LockedUntil = 0;
  p1Eliminated = false; p2Eliminated = false;
  if(p1LockIcon) p1LockIcon.style.display = "none";
  if(p2LockIcon) p2LockIcon.style.display = "none";
  
  // Center reticles
  p1Pos = { x: MAP_WIDTH/3, y: MAP_HEIGHT/2 };
  p2Pos = { x: (MAP_WIDTH/3)*2, y: MAP_HEIGHT/2 };
  
  if (p1Reticle) p1Reticle.style.display = 'inline';
  if (p2Reticle) p2Reticle.style.display = playerCount === 2 ? 'inline' : 'none';
  
  const loc = currentLocations[currentRoundIndex];
  document.getElementById('geogame-location-display').textContent = loc.location_name;
  document.getElementById('geogame-round').textContent = `${currentRoundIndex + 1}/${currentLocations.length}`;
  document.getElementById('geogame-status-text').textContent = 
    inputMode === 'mouse' ? "Click the map to guess!" : "Use D-Pad/Stick to move, press ANY BUTTON to guess!";
  
  resetMapView();
  clearPins();
  startTimer(15);
  
  if (inputMode === 'gamepad') {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    pollGamepadsForReticles();
  }
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  const fill = document.querySelector('#geogame-timer-bar .timer-fill');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  void fill.offsetWidth;
  fill.style.transition = `width ${seconds}s linear`;
  fill.style.width = '0%';
  
  let timeLeft = seconds;
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

function handleTimeOut() {
  if (currentState !== 'GUESSING') return;
  document.getElementById('geogame-status-text').textContent = "⏰ Time's up!";
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  
  // Both failed
  if (!p1HasGuessed && !p2HasGuessed) {
    revealTarget(0, 0, 'Nobody');
  } else {
    evaluateGuesses();
  }
}

// ==========================================
// INPUT HANDLING
// ==========================================

function handleMouseClick(e) {
  if (currentState !== 'GUESSING' || inputMode !== 'mouse' || !mapSvg) return;
  clearInterval(timerInterval);
  
  const pt = mapSvg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgP = pt.matrixTransform(mapSvg.getScreenCTM().inverse());
  
  p1Guess = { x: svgP.x, y: svgP.y };
  p1HasGuessed = true;
  evaluateGuesses();
}

let p1Axes = { x: 0, y: 0 };
let p2Axes = { x: 0, y: 0 };

window.addEventListener('app_gamepad_axes', (e) => {
  if (e.detail.player === 0) {
    p1Axes.x = e.detail.axes[0];
    p1Axes.y = e.detail.axes[1];
  } else if (e.detail.player === 1) {
    p2Axes.x = e.detail.axes[0];
    p2Axes.y = e.detail.axes[1];
  }
});

function pollGamepadsForReticles() {
  if (currentState !== 'GUESSING') return;
  
  const speed = currentZoom === 0 ? 3 : 1; // Pixels per frame (slower for zoom)
  
  const processAxes = (axes, posObj) => {
    if (Math.abs(axes.x) > 0.1) posObj.x += axes.x * speed;
    if (Math.abs(axes.y) > 0.1) posObj.y += axes.y * speed;
    
    // Bounds check
    posObj.x = Math.max(0, Math.min(MAP_WIDTH, posObj.x));
    posObj.y = Math.max(0, Math.min(MAP_HEIGHT, posObj.y));
  };
  
  const now = Date.now();
  let activeX1 = p1Axes.x;
  let activeY1 = p1Axes.y;
  let activeX2 = p2Axes.x;
  let activeY2 = p2Axes.y;

  // Also poll HTML5 Gamepads as fallback for local axes and D-pad
  const gp1 = getGamepadForPlayer(0);
  const gp2 = getGamepadForPlayer(1);
  
  if (gp1) {
      let localX = 0, localY = 0;
      if (gp1.axes && gp1.axes.length >= 2) {
          if (Math.abs(gp1.axes[0]) > 0.1) localX = gp1.axes[0];
          if (Math.abs(gp1.axes[1]) > 0.1) localY = gp1.axes[1];
      }
      if (gp1.buttons && gp1.buttons.length > 15) {
          if (gp1.buttons[14].pressed) localX = -1;
          if (gp1.buttons[15].pressed) localX = 1;
          if (gp1.buttons[12].pressed) localY = -1;
          if (gp1.buttons[13].pressed) localY = 1;
      }
      if (localX !== 0 || localY !== 0) {
          activeX1 = localX; activeY1 = localY;
      }
  }
  
  if (gp2) {
      let localX = 0, localY = 0;
      if (gp2.axes && gp2.axes.length >= 2) {
          if (Math.abs(gp2.axes[0]) > 0.1) localX = gp2.axes[0];
          if (Math.abs(gp2.axes[1]) > 0.1) localY = gp2.axes[1];
      }
      if (gp2.buttons && gp2.buttons.length > 15) {
          if (gp2.buttons[14].pressed) localX = -1;
          if (gp2.buttons[15].pressed) localX = 1;
          if (gp2.buttons[12].pressed) localY = -1;
          if (gp2.buttons[13].pressed) localY = 1;
      }
      if (localX !== 0 || localY !== 0) {
          activeX2 = localX; activeY2 = localY;
      }
  }

  if (!p1Eliminated && !p1HasGuessed && now >= p1LockedUntil) processAxes({x: activeX1, y: activeY1}, p1Pos);
  if (playerCount === 2 && !p2Eliminated && !p2HasGuessed && now >= p2LockedUntil) processAxes({x: activeX2, y: activeY2}, p2Pos);

  // Render Reticles
  // Helper to calculate SVG pie slice path
  const describeArc = (x, y, radius, startAngle, endAngle) => {
      const polarToCartesian = (cx, cy, r, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return { x: cx + (r * Math.cos(angleInRadians)), y: cy + (r * Math.sin(angleInRadians)) };
      };
      
      const start = polarToCartesian(x, y, radius, endAngle);
      const end = polarToCartesian(x, y, radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return [
          "M", x, y,
          "L", start.x, start.y,
          "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
          "Z"
      ].join(" ");
  };

  const renderFeedback = (pos, lockedUntil, lockMsg, feedbackIcon, reticle, hasGuessed, eliminated) => {
     if (eliminated || hasGuessed) {
        if (reticle) reticle.style.display = 'none';
        if (feedbackIcon) feedbackIcon.style.display = 'none';
        return;
     }
     
     if (now < lockedUntil) {
        if (reticle) reticle.style.display = 'none';
        if (feedbackIcon) {
           feedbackIcon.style.display = 'inline';
           feedbackIcon.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
           
           const txt = feedbackIcon.querySelector('text');
           const path = feedbackIcon.querySelector('path');
           const bg = feedbackIcon.querySelector('circle');
           
           if (lockMsg === "COUNTDOWN") {
              if (bg) bg.style.display = 'inline';
              if (path) path.style.display = 'inline';
              const remainingMs = lockedUntil - now;
              const secsLeft = Math.ceil(remainingMs / 1000);
              txt.textContent = secsLeft.toString();
              txt.setAttribute('font-size', '20');
              
              // Draw the circular wipe
              const progress = Math.max(0, Math.min(1, remainingMs / 3000));
              const angle = progress * 360;
              if (path) path.setAttribute('d', describeArc(0, 0, 20, 0, angle));
           } else {
              if (bg) bg.style.display = 'none';
              if (path) path.style.display = 'none';
              txt.textContent = lockMsg;
              txt.setAttribute('font-size', '14');
           }
        }
     } else {
        if (reticle) {
           reticle.style.display = 'inline';
           reticle.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        }
        if (feedbackIcon) feedbackIcon.style.display = 'none';
     }
  };

  renderFeedback(p1Pos, p1LockedUntil, p1LockMessage, p1LockIcon, p1Reticle, p1HasGuessed, p1Eliminated);
  if (playerCount === 2) {
     renderFeedback(p2Pos, p2LockedUntil, p2LockMessage, p2LockIcon, p2Reticle, p2HasGuessed, p2Eliminated);
  }
  
  animationFrameId = requestAnimationFrame(pollGamepadsForReticles);
}

function handleGamepadButton(e) {
  if (currentState === 'INTRO' && inputMode === 'gamepad') {
    beginStartFlow();
    return;
  }
  
  if (currentState !== 'GUESSING' || inputMode !== 'gamepad' || isTransitioning) return;
  const { button, player } = e.detail;
  
  if (['A', 'B', 'X', 'Y'].includes(button)) {
    const isP1 = (player === 0);
    const now = Date.now();
    
    if (isP1 && (p1Eliminated || now < p1LockedUntil)) return;
    if (!isP1 && (p2Eliminated || now < p2LockedUntil || playerCount === 1)) return;
    
    const pos = isP1 ? p1Pos : p2Pos;
    const target = currentLocations[currentRoundIndex];
    const latLon = xyToLatLon(pos.x, pos.y);
    const dist = calculateDistance(latLon.lat, latLon.lon, target.lat, target.lon);
    
    if (dist > 4.0) {
      if (isP1) { p1LockedUntil = now + 2000; p1LockMessage = "Wild guess"; }
      else { p2LockedUntil = now + 2000; p2LockMessage = "Wild guess"; }
      return;
    }
    
    if (isP1) { p1HasGuessed = true; p1Guess = { ...p1Pos }; }
    else { p2HasGuessed = true; p2Guess = { ...p2Pos }; }
    
    
    if (playerCount === 1) {
       clearInterval(timerInterval);
       evaluateGuesses();
    } else {
       // --- MULTIPLAYER MATH SCORING & ZOOM ---
       if (dist <= 0.05) { // 50m direct hit
          clearInterval(timerInterval);
          const pts = calculatePoints(dist);
          document.getElementById('geogame-status-text').textContent = `🎯 Player ${isP1 ? 1 : 2} Direct Hit! (${(dist*1000).toFixed(0)}m)`;
          revealTarget(isP1 ? pts : 0, isP1 ? 0 : pts, `Player ${isP1 ? 1 : 2}`);
       } else {
          if (currentZoom < 2) {
             // Near Miss -> Zoom and let the other player steal!
             clearInterval(timerInterval);
             document.getElementById('geogame-status-text').textContent = `Player ${isP1 ? 1 : 2} is ${(dist*1000).toFixed(0)}m away. Zooming in for STEAL!`;
             // Don't eliminate yet! Give them a countdown lock!
             if (isP1) p1Eliminated = false; else p2Eliminated = false;
             const tempPin = drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444"); // Bright initial pin
             
             isTransitioning = true;
             setTimeout(() => {
                isTransitioning = false;
                const targetPt = latLonToXY(target.lat, target.lon);
                const zoomData = calculateZoomViewBox(pos.x, pos.y, targetPt.x, targetPt.y, currentZoom);
                mapSvg.setAttribute('viewBox', `${zoomData.x} ${zoomData.y} ${zoomData.width} ${zoomData.height}`);
                currentZoom++;
                currentState = 'GUESSING';
                
                // Instead of clearPins, remove the bright temp pin, and add a persistent dark one
                if (tempPin && tempPin.parentNode) tempPin.parentNode.removeChild(tempPin);
                const ghostPin = drawGuessMarker(pos.x, pos.y, isP1 ? "#1e3a8a" : "#7f1d1d");
                if (ghostPin) ghostPin.style.opacity = '0.5';
                
                // Teleport BOTH players into the zoomed area!
                p1Pos.x = zoomData.center.x; p1Pos.y = zoomData.center.y;
                p2Pos.x = zoomData.center.x; p2Pos.y = zoomData.center.y;
                
                // Set the penalty lock for the person who guessed
                const lockTime = Date.now() + 3000;
                if (isP1) { p1LockedUntil = lockTime; p1LockMessage = "COUNTDOWN"; }
                else { p2LockedUntil = lockTime; p2LockMessage = "COUNTDOWN"; }
                
                // Also reset their "guessed" status so they can guess again
                if (isP1) { p1HasGuessed = false; p1Guess = null; }
                else { p2HasGuessed = false; p2Guess = null; }
                
                document.getElementById('geogame-status-text').textContent = `STEAL ROUND! Player ${isP1 ? 2 : 1} gets a head start!`;
                startTimer(15);
                pollGamepadsForReticles();
             }, 2000);
          } else {
             // Missed Steal Round!
             if (isP1) p1Eliminated = true; else p2Eliminated = true;
             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
             
             if (p1Eliminated && p2Eliminated) {
                clearInterval(timerInterval);
                // End of round: both guessed. Closest wins!
                evaluateClosestWins(target);
             }
          }
       }
    }
  }
}

function evaluateClosestWins(target) {
  let p1Dist = 999, p2Dist = 999;
  if (p1Guess) p1Dist = calculateDistance(xyToLatLon(p1Guess.x, p1Guess.y).lat, xyToLatLon(p1Guess.x, p1Guess.y).lon, target.lat, target.lon);
  if (p2Guess) p2Dist = calculateDistance(xyToLatLon(p2Guess.x, p2Guess.y).lat, xyToLatLon(p2Guess.x, p2Guess.y).lon, target.lat, target.lon);
  
  const p1Pts = calculatePoints(p1Dist);
  const p2Pts = calculatePoints(p2Dist);
  
  if (p1Dist < p2Dist && p1Pts > 0) {
     document.getElementById('geogame-status-text').textContent = `Player 1 was closer! (${(p1Dist*1000).toFixed(0)}m)`;
     revealTarget(p1Pts, 0, 'Player 1');
  } else if (p2Dist < p1Dist && p2Pts > 0) {
     document.getElementById('geogame-status-text').textContent = `Player 2 was closer! (${(p2Dist*1000).toFixed(0)}m)`;
     revealTarget(0, p2Pts, 'Player 2');
  } else if (p1Pts > 0 && p1Pts === p2Pts) {
     document.getElementById('geogame-status-text').textContent = `Tie! Both get ${p1Pts} pts!`;
     revealTarget(p1Pts, p2Pts, 'Tie');
  } else {
     document.getElementById('geogame-status-text').textContent = `❌ Both missed completely!`;
     revealTarget(0, 0, 'Nobody');
  }
}
// ==========================================
// SCORING
// ==========================================

function evaluateGuesses() {
  if (isTransitioning) return;
  currentState = 'SCORING';
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  const target = currentLocations[currentRoundIndex];
  
  let p1Dist = 999, p2Dist = 999;
  
  if (p1HasGuessed) {
    const latLon = xyToLatLon(p1Guess.x, p1Guess.y);
    p1Dist = calculateDistance(latLon.lat, latLon.lon, target.lat, target.lon);
  }
  if (p2HasGuessed) {
    const latLon = xyToLatLon(p2Guess.x, p2Guess.y);
    p2Dist = calculateDistance(latLon.lat, latLon.lon, target.lat, target.lon);
  }
  
  // Single Player Zoom Logic
  if (playerCount === 1) {
    if (p1Dist <= 0.05) {
      const pts = calculatePoints(p1Dist);
      document.getElementById('geogame-status-text').textContent = `🎯 Direct Hit! +${pts} pts (${(p1Dist * 1000).toFixed(0)}m)`;
      revealTarget(pts, 0, 'Player 1');
    } else if (p1Dist < 4.0 && currentZoom < 2) {
      document.getElementById('geogame-status-text').textContent = `Near Miss (${p1Dist.toFixed(1)}km). Zooming in...`;
      const pts = calculatePoints(p1Dist);
      const tempPin = drawGuessMarker(p1Guess.x, p1Guess.y, "#3b82f6");
      isTransitioning = true;
      setTimeout(() => {
        const targetPt = latLonToXY(target.lat, target.lon);
        const zoomData = calculateZoomViewBox(p1Guess.x, p1Guess.y, targetPt.x, targetPt.y, currentZoom);
        mapSvg.setAttribute('viewBox', `${zoomData.x} ${zoomData.y} ${zoomData.width} ${zoomData.height}`);
        p1Pos.x = zoomData.center.x; p1Pos.y = zoomData.center.y;
        
        if (tempPin && tempPin.parentNode) tempPin.parentNode.removeChild(tempPin);
        const ghostPin = drawGuessMarker(p1Guess.x, p1Guess.y, "#1e3a8a");
        if (ghostPin) ghostPin.style.opacity = '0.5';
        
        document.getElementById('geogame-status-text').innerHTML = `<span style="color: var(--accent-primary); font-weight: bold; font-size: 1.2em; animation: textPulse 1s infinite;">Try again!</span> Worth ${pts} pts`;
        
        setTimeout(() => {
          isTransitioning = false;
          currentZoom++;
          currentState = 'GUESSING';
          p1HasGuessed = false; // reset
          startTimer(10);
          if (inputMode === 'gamepad') {
            p1Reticle.style.display = 'inline';
            pollGamepadsForReticles();
          }
        }, 1500);
      }, 1500);
    } else {
      document.getElementById('geogame-status-text').textContent = `❌ Missed! (${p1Dist.toFixed(1)}km away)`;
      revealTarget(0, 0, 'Nobody');
    }
    return;
  }
  
  // Multiplayer Timeout Logic
  if (playerCount === 2) {
     if (isTransitioning) return;
     // If timer runs out, evaluate whoever guessed!
     evaluateClosestWins(target);
  }
}

function revealTarget(pts1, pts2, winnerName) {
  currentState = 'SCORING';
  const target = currentLocations[currentRoundIndex];
  
  p1Score += pts1;
  p2Score += pts2;
  updateScoreUI(pts1, pts2);
  
  const targetPt = latLonToXY(target.lat, target.lon);
  
  // Clamp target pin so it doesn't clip off the screen
  targetPt.x = Math.max(25, Math.min(MAP_WIDTH - 25, targetPt.x));
  targetPt.y = Math.max(25, Math.min(MAP_HEIGHT - 25, targetPt.y));
  
  const pinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pinGroup.classList.add('game-pin');
  
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", targetPt.x);
  ring.setAttribute("cy", targetPt.y);
  ring.setAttribute("r", "18");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", (pts1>0 || pts2>0) ? "#4ade80" : "#f87171");
  ring.setAttribute("stroke-width", "2");
  pinGroup.appendChild(ring);
  
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", targetPt.x);
  dot.setAttribute("cy", targetPt.y);
  dot.setAttribute("r", "6");
  dot.setAttribute("fill", (pts1>0 || pts2>0) ? "#4ade80" : "#f87171");
  pinGroup.appendChild(dot);
  
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", targetPt.x);
  label.setAttribute("y", targetPt.y - 25);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("fill", "white");
  label.setAttribute("font-size", "14px");
  label.setAttribute("font-weight", "bold");
  label.setAttribute("filter", "drop-shadow(0px 2px 2px rgba(0,0,0,0.8))");
  label.textContent = target.location_name;
  pinGroup.appendChild(label);
  
  mapSvg.appendChild(pinGroup);
  
  fetch('/api/geogame/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location_name: target.location_name,
      winner: winnerName,
      points_awarded: Math.max(pts1, pts2),
      zoom_level: currentZoom
    })
  }).catch(err => console.error(err));
  
  setTimeout(() => {
    currentRoundIndex++;
    startRound();
  }, 4000);
}

function endGame() {
  switchScreen('game'); // Ensure we stay here
  currentState = 'GAME_OVER';
  document.getElementById('geogame-status-text').textContent = "Game Over!";
  
  let endText = `${p1Score} pts`;
  if (playerCount === 2) {
    if (p1Score > p2Score) endText = `Player 1 Wins! (${p1Score} - ${p2Score})`;
    else if (p2Score > p1Score) endText = `Player 2 Wins! (${p2Score} - ${p1Score})`;
    else endText = `Tie Game! (${p1Score} - ${p2Score})`;
  }
  
  document.getElementById('geogame-final-score').textContent = endText;
  document.getElementById('geogame-end-modal').classList.remove('hidden');
  
  if (inputMode === 'gamepad') {
      const btn = document.getElementById('btn-geogame-restart');
      btn.classList.add('gamepad-focus');
      btn.innerHTML = `Play Again <br><span style="font-size: 0.7em; color: #fbbf24;">(Press A)</span>`;
  }
}

// ==========================================
// PROJECTION & UTILITIES
// ==========================================










function drawGuessMarker(x, y, color = "#ef4444") {
  if (!mapSvg) return null;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.classList.add('game-pin');
  
  const size = 8;
  const h = document.createElementNS("http://www.w3.org/2000/svg", "line");
  h.setAttribute("x1", x - size); h.setAttribute("y1", y);
  h.setAttribute("x2", x + size); h.setAttribute("y2", y);
  h.setAttribute("stroke", color); h.setAttribute("stroke-width", "2");
  group.appendChild(h);
  
  const v = document.createElementNS("http://www.w3.org/2000/svg", "line");
  v.setAttribute("x1", x); v.setAttribute("y1", y - size);
  v.setAttribute("x2", x); v.setAttribute("y2", y + size);
  v.setAttribute("stroke", color); v.setAttribute("stroke-width", "2");
  group.appendChild(v);
  
  const pinsLayer = document.getElementById("pins-layer");
  if (pinsLayer) pinsLayer.appendChild(group);
  else mapSvg.appendChild(group);
  return group;
}

function clearPins() {
  const pinsLayer = document.getElementById("pins-layer");
  if (pinsLayer) pinsLayer.innerHTML = '';
}

function resetMapView() {
  if (mapSvg) {
    mapSvg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  }
}





function updateScoreUI(pts1 = 0, pts2 = 0) {
  const p1Disp = document.getElementById('geogame-score');
  const p1Val = document.getElementById('geogame-p1-score-val');
  const p2Val = document.getElementById('geogame-p2-score-val');
  
  p1Disp.textContent = p1Score;
  p1Val.textContent = p1Score;
  p2Val.textContent = p2Score;
  
  if (pts1 > 0) {
      p1Disp.classList.remove('score-bump');
      p1Val.classList.remove('score-bump');
      void p1Disp.offsetWidth; // trigger reflow
      p1Disp.classList.add('score-bump');
      p1Val.classList.add('score-bump');
  }
  if (pts2 > 0) {
      p2Val.classList.remove('score-bump');
      void p2Val.offsetWidth;
      p2Val.classList.add('score-bump');
  }
}


