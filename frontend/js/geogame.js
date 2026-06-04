import { startBinding } from './gamepad.js';

// ==========================================
// BOUNDING BOX
// ==========================================
const MAP_BOUNDS = {
  minLon: -75.9375,
  maxLon: -75.5859375,
  minLat: 45.27488643704892,
  maxLat: 45.460130637921
};

const MAP_WIDTH = 1024;
const MAP_HEIGHT = 768;

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

// DOM Elements
let container, mapContainer, mapSvg;
let screens = {};
let p1Reticle, p2Reticle;

// ==========================================
// INIT & LIFECYCLE
// ==========================================

export function initGeoGame() {
  container = document.getElementById('geogame-mode');
  if (!container) return;
  
  screens = {
    intro: document.getElementById('geogame-intro-screen'),
    binding: document.getElementById('geogame-binding-screen'),
    countdown: document.getElementById('geogame-countdown-screen'),
    game: document.getElementById('geogame-game-screen')
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
  
  const bgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
  bgImage.setAttribute("href", "/frontend/assets/ottawa_map_carto.png");
  bgImage.setAttribute("width", MAP_WIDTH);
  bgImage.setAttribute("height", MAP_HEIGHT);
  mapSvg.appendChild(bgImage);
  
  mapContainer.appendChild(mapSvg);
}

function setupReticles() {
  if (p1Reticle) p1Reticle.remove();
  if (p2Reticle) p2Reticle.remove();
  
  if (inputMode === 'gamepad') {
    p1Reticle = createReticle("#3b82f6");
    mapSvg.appendChild(p1Reticle);
    if (playerCount === 2) {
      p2Reticle = createReticle("#ef4444");
      mapSvg.appendChild(p2Reticle);
    }
  }
}

function createReticle(color) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.innerHTML = `
    <circle cx="0" cy="0" r="10" fill="none" stroke="${color}" stroke-width="2"/>
    <line x1="-15" y1="0" x2="-5" y2="0" stroke="${color}" stroke-width="2"/>
    <line x1="5" y1="0" x2="15" y2="0" stroke="${color}" stroke-width="2"/>
    <line x1="0" y1="-15" x2="0" y2="-5" stroke="${color}" stroke-width="2"/>
    <line x1="0" y1="5" x2="0" y2="15" stroke="${color}" stroke-width="2"/>
  `;
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
  
  // Center reticles
  p1Pos = { x: MAP_WIDTH/3, y: MAP_HEIGHT/2 };
  p2Pos = { x: (MAP_WIDTH/3)*2, y: MAP_HEIGHT/2 };
  
  if (p1Reticle) p1Reticle.style.display = 'block';
  if (p2Reticle) p2Reticle.style.display = playerCount === 2 ? 'block' : 'none';
  
  const loc = currentLocations[currentRoundIndex];
  document.getElementById('geogame-location-display').textContent = loc.location_name;
  document.getElementById('geogame-round').textContent = `${currentRoundIndex + 1}/${currentLocations.length}`;
  document.getElementById('geogame-status-text').textContent = 
    inputMode === 'mouse' ? "Click the map to guess!" : "Use Analog Stick to move, 'A' to guess!";
  
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

function pollGamepadsForReticles() {
  if (currentState !== 'GUESSING') return;
  
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const speed = 10; // Pixels per frame
  
  // Use existing gamepad map from Quiz mode integration (gamepad.js sets gamepadToPlayerMap)
  // But wait, gamepad.js doesn't export gamepadToPlayerMap!
  // Fallback: Just assume the first two gamepads are P1 and P2 in order.
  let activeGpIndices = [];
  for (let i = 0; i < gps.length; i++) {
    if (gps[i]) activeGpIndices.push(i);
  }
  
  const processGp = (gp, posObj) => {
    if (!gp) return;
    const axX = gp.axes[0];
    const axY = gp.axes[1];
    if (Math.abs(axX) > 0.1) posObj.x += axX * speed;
    if (Math.abs(axY) > 0.1) posObj.y += axY * speed;
    
    // Bounds check
    posObj.x = Math.max(0, Math.min(MAP_WIDTH, posObj.x));
    posObj.y = Math.max(0, Math.min(MAP_HEIGHT, posObj.y));
  };

  if (!p1HasGuessed && activeGpIndices.length > 0) {
    processGp(gps[activeGpIndices[0]], p1Pos);
    p1Reticle.setAttribute('transform', `translate(${p1Pos.x}, ${p1Pos.y})`);
  }
  
  if (playerCount === 2 && !p2HasGuessed && activeGpIndices.length > 1) {
    processGp(gps[activeGpIndices[1]], p2Pos);
    p2Reticle.setAttribute('transform', `translate(${p2Pos.x}, ${p2Pos.y})`);
  }
  
  animationFrameId = requestAnimationFrame(pollGamepadsForReticles);
}

function handleGamepadButton(e) {
  if (currentState === 'INTRO' && inputMode === 'gamepad') {
    beginStartFlow();
    return;
  }
  
  if (currentState !== 'GUESSING' || inputMode !== 'gamepad') return;
  const { button, player } = e.detail;
  
  if (button === 'A') {
    if (player === 0 && !p1HasGuessed) {
      p1Guess = { ...p1Pos };
      p1HasGuessed = true;
      if (p1Reticle) p1Reticle.style.display = 'none';
      drawGuessMarker(p1Guess.x, p1Guess.y, "#3b82f6");
    } else if (player === 1 && !p2HasGuessed && playerCount === 2) {
      p2Guess = { ...p2Pos };
      p2HasGuessed = true;
      if (p2Reticle) p2Reticle.style.display = 'none';
      drawGuessMarker(p2Guess.x, p2Guess.y, "#ef4444");
    }
    
    // Check if everyone has guessed
    if (playerCount === 1 && p1HasGuessed) {
      clearInterval(timerInterval);
      evaluateGuesses();
    } else if (playerCount === 2 && p1HasGuessed && p2HasGuessed) {
      clearInterval(timerInterval);
      evaluateGuesses();
    }
  }
}

// ==========================================
// SCORING
// ==========================================

function evaluateGuesses() {
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
    if (p1Dist < 0.8) {
      const pts = 100;
      document.getElementById('geogame-status-text').textContent = `🎯 Direct Hit! +${pts} pts (${(p1Dist * 1000).toFixed(0)}m)`;
      revealTarget(pts, 0, 'Player 1');
    } else if (p1Dist < 3.0 && currentZoom === 0) {
      document.getElementById('geogame-status-text').textContent = `Near Miss (${p1Dist.toFixed(1)}km). Zooming in...`;
      const pts = 50;
      setTimeout(() => {
        zoomMapTo(p1Guess.x, p1Guess.y, 2.5);
        currentZoom = 1;
        currentState = 'GUESSING';
        p1HasGuessed = false; // reset
        clearPins();
        document.getElementById('geogame-status-text').textContent = `Try again! Worth ${pts} pts`;
        startTimer(10);
        if (inputMode === 'gamepad') {
          p1Reticle.style.display = 'block';
          pollGamepadsForReticles();
        }
      }, 1500);
    } else {
      document.getElementById('geogame-status-text').textContent = `❌ Missed! (${p1Dist.toFixed(1)}km away)`;
      revealTarget(0, 0, 'Nobody');
    }
    return;
  }
  
  // Multiplayer Steal Logic
  if (playerCount === 2) {
    const firstGuesser = p1HasGuessed ? 1 : 2; 
    // In sudden death scenario, the first to click is handled implicitly if we don't wait for the second.
    // Wait, the logic is: "First player that clicks gets points. if not exact, zoom in and 2nd player steals"
    // So if someone clicked and isn't perfect, we zoom in for the other player.
    // Let's implement the Steal:
    
    const bestDist = Math.min(p1Dist, p2Dist);
    let winnerPts = 0;
    let winnerStr = '';
    
    // If someone got a direct hit
    if (bestDist < 0.8) {
      winnerPts = 100;
      if (p1Dist < p2Dist) {
        winnerStr = 'Player 1';
        revealTarget(winnerPts, 0, winnerStr);
      } else {
        winnerStr = 'Player 2';
        revealTarget(0, winnerPts, winnerStr);
      }
      document.getElementById('geogame-status-text').textContent = `🎯 ${winnerStr} Direct Hit!`;
    } 
    // If it's the first zoom phase, zoom in on the best guess and allow steal
    else if (bestDist < 3.0 && currentZoom === 0) {
      const zoomX = p1Dist < p2Dist ? p1Guess.x : p2Guess.x;
      const zoomY = p1Dist < p2Dist ? p1Guess.y : p2Guess.y;
      
      document.getElementById('geogame-status-text').textContent = `Near Miss! Zooming in for STEAL!`;
      setTimeout(() => {
        zoomMapTo(zoomX, zoomY, 2.5);
        currentZoom = 1;
        currentState = 'GUESSING';
        
        // Reset guesses
        p1HasGuessed = false;
        p2HasGuessed = false;
        p1Guess = null; p2Guess = null;
        clearPins();
        
        document.getElementById('geogame-status-text').textContent = `STEAL ROUND! First to hit wins 50 pts`;
        startTimer(10);
        if (p1Reticle) p1Reticle.style.display = 'block';
        if (p2Reticle) p2Reticle.style.display = 'block';
        pollGamepadsForReticles();
      }, 1500);
    } 
    // Complete miss
    else {
      document.getElementById('geogame-status-text').textContent = `❌ Both missed!`;
      revealTarget(0, 0, 'Nobody');
    }
  }
}

function revealTarget(pts1, pts2, winnerName) {
  currentState = 'SCORING';
  const target = currentLocations[currentRoundIndex];
  
  p1Score += pts1;
  p2Score += pts2;
  updateScoreUI();
  
  const targetPt = latLonToXY(target.lat, target.lon);
  
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
  label.setAttribute("y", targetPt.y - 24);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("fill", "white");
  label.setAttribute("font-size", "11");
  label.setAttribute("font-weight", "600");
  label.textContent = target.location_name;
  pinGroup.appendChild(label);
  
  mapSvg.appendChild(pinGroup);
  
  fetch('/api/geogame/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location_name: target.location_name,
      winner: winnerName,
      points_awarded: pts1 + pts2,
      zoom_level: currentZoom
    })
  });
  
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
}

// ==========================================
// PROJECTION & UTILITIES
// ==========================================

function latLonToXY(lat, lon) {
  const x = ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * MAP_WIDTH;
  const yMin = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.minLat * Math.PI / 180) / 2));
  const yMax = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.maxLat * Math.PI / 180) / 2));
  const yMerc = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const y = MAP_HEIGHT - ((yMerc - yMin) / (yMax - yMin)) * MAP_HEIGHT;
  return { x, y };
}

function xyToLatLon(x, y) {
  const lon = MAP_BOUNDS.minLon + (x / MAP_WIDTH) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const yMin = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.minLat * Math.PI / 180) / 2));
  const yMax = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.maxLat * Math.PI / 180) / 2));
  const yMerc = yMin + ((MAP_HEIGHT - y) / MAP_HEIGHT) * (yMax - yMin);
  const lat = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI;
  return { lat, lon };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const latDiff = (lat2 - lat1) * 111;
  const lonDiff = (lon2 - lon1) * 78;
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
}

function drawGuessMarker(x, y, color = "#ef4444") {
  if (!mapSvg) return;
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
  
  mapSvg.appendChild(group);
}

function clearPins() {
  if (!mapSvg) return;
  mapSvg.querySelectorAll('.game-pin').forEach(p => p.remove());
}

function resetMapView() {
  if (mapSvg) {
    mapSvg.style.transform = 'none';
    mapSvg.style.transformOrigin = 'center center';
  }
}

function zoomMapTo(x, y, scale) {
  if (!mapSvg) return;
  const originX = (x / MAP_WIDTH) * 100;
  const originY = (y / MAP_HEIGHT) * 100;
  mapSvg.style.transformOrigin = `${originX}% ${originY}%`;
  mapSvg.style.transform = `scale(${scale})`;
}

function updateScoreUI() {
  document.getElementById('geogame-score').textContent = p1Score;
  document.getElementById('geogame-p1-score-val').textContent = p1Score;
  document.getElementById('geogame-p2-score-val').textContent = p2Score;
}
