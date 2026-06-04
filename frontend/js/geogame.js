// geogame.js - Ottawa GeoGame Logic

// Ottawa Bounding Box (approximate urban core)
const MAP_BOUNDS = {
  minLon: -75.95,
  maxLon: -75.45,
  minLat: 45.20,
  maxLat: 45.50
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 800;

// Game State
let currentState = 'IDLE'; // IDLE, REVEAL, GUESSING, SCORING, ROUND_OVER, GAME_OVER
let currentLocations = [];
let currentRoundIndex = 0;
let totalScore = 0;
let currentZoom = 0;
let timerInterval = null;

// DOM Elements
let container, mapContainer, mapSvg;
let locationDisplay, scoreDisplay, roundDisplay, statusText, timerFill;

export function initGeoGame() {
  container = document.getElementById('geogame-mode');
  if (!container) return;
  
  mapContainer = document.getElementById('geogame-map-container');
  locationDisplay = document.getElementById('geogame-location-display');
  scoreDisplay = document.getElementById('geogame-score');
  roundDisplay = document.getElementById('geogame-round');
  statusText = document.getElementById('geogame-status-text');
  timerFill = document.querySelector('.timer-fill');
  
  const restartBtn = document.getElementById('btn-geogame-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', startNewGame);
  }

  // Set up mouse click listener for 1-player mode
  mapContainer.addEventListener('click', handleMapClick);

  drawMap();
}

export function startGeoGame() {
  // Only start if switching to this tab
  if (currentState === 'IDLE' || currentState === 'GAME_OVER') {
    startNewGame();
  }
}

async function startNewGame() {
  document.getElementById('geogame-end-modal').classList.add('hidden');
  totalScore = 0;
  currentRoundIndex = 0;
  scoreDisplay.textContent = '0';
  statusText.textContent = "Loading locations...";
  
  try {
    const res = await fetch('/api/geogame/locations');
    const data = await res.json();
    if (data.status === 'success' && data.locations.length > 0) {
      // Limit to 5 rounds for now
      currentLocations = data.locations.slice(0, 5);
      startRound();
    } else {
      statusText.textContent = "Error: No locations found in database.";
    }
  } catch (e) {
    console.error(e);
    statusText.textContent = "Error fetching game data.";
  }
}

function startRound() {
  if (currentRoundIndex >= currentLocations.length) {
    endGame();
    return;
  }
  
  currentState = 'GUESSING';
  currentZoom = 0;
  
  const loc = currentLocations[currentRoundIndex];
  locationDisplay.textContent = loc.location_name;
  roundDisplay.textContent = `${currentRoundIndex + 1}/${currentLocations.length}`;
  statusText.textContent = `Click the map to guess the location. Potential Points: ${loc.point_value}`;
  
  // Reset map zoom and clear pins/reticles
  resetMapView();
  clearPins();
  
  // Start Timer
  startTimer(15);
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';
  
  // Force reflow
  void timerFill.offsetWidth;
  
  timerFill.style.transition = `width ${seconds}s linear`;
  timerFill.style.width = '0%';
  
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
  statusText.textContent = "Time's up!";
  revealTarget(0); // 0 points
}

function handleMapClick(e) {
  if (currentState !== 'GUESSING') return;
  
  clearInterval(timerInterval);
  
  // Get click coordinates relative to the SVG viewbox
  const rect = mapSvg.getBoundingClientRect();
  const scaleX = MAP_WIDTH / rect.width;
  const scaleY = MAP_HEIGHT / rect.height;
  
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;
  
  // Convert click to Lat/Lon
  const guessLon = MAP_BOUNDS.minLon + (clickX / MAP_WIDTH) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const guessLat = MAP_BOUNDS.maxLat - (clickY / MAP_HEIGHT) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  
  checkGuess(guessLat, guessLon, clickX, clickY);
}

function checkGuess(guessLat, guessLon, clickX, clickY) {
  const target = currentLocations[currentRoundIndex];
  
  // Very rough distance calculation (Euclidean for localized gameplay is fine)
  // 1 degree lat ~ 111km. At 45 deg, 1 degree lon ~ 78km.
  const latDiff = (target.lat - guessLat) * 111;
  const lonDiff = (target.lon - guessLon) * 78;
  const distanceKm = Math.sqrt(latDiff*latDiff + lonDiff*lonDiff);
  
  // Draw the player's guess pin
  drawReticle(clickX, clickY, 'reticle-p1');
  
  // Scoring logic
  let pointsEarned = 0;
  if (distanceKm < 1.0) {
    // Direct Hit (< 1km)
    pointsEarned = target.point_value;
    statusText.textContent = `Direct Hit! +${pointsEarned} Points`;
    revealTarget(pointsEarned);
  } else if (distanceKm < 5.0 && currentZoom === 0) {
    // Near Miss - Zoom in for a second chance
    statusText.textContent = `Near Miss (${distanceKm.toFixed(1)}km). Zooming in...`;
    pointsEarned = Math.floor(target.point_value / 2);
    
    setTimeout(() => {
      zoomMapTo(clickX, clickY, 2.5);
      currentZoom = 1;
      currentState = 'GUESSING';
      statusText.textContent = `Try again! Potential Points: ${pointsEarned}`;
      startTimer(10);
    }, 1500);
  } else {
    // Miss
    statusText.textContent = `Missed! (${distanceKm.toFixed(1)}km away)`;
    revealTarget(0);
  }
}

function revealTarget(points) {
  currentState = 'SCORING';
  const target = currentLocations[currentRoundIndex];
  
  totalScore += points;
  scoreDisplay.textContent = totalScore;
  
  const targetPt = latLonToXY(target.lat, target.lon);
  
  // Draw actual pin
  const pin = document.createElement('div');
  pin.className = 'target-pin';
  pin.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="var(--accent-primary)" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`;
  pin.style.left = `${(targetPt.x / MAP_WIDTH) * 100}%`;
  pin.style.top = `${(targetPt.y / MAP_HEIGHT) * 100}%`;
  mapContainer.appendChild(pin);
  
  // Save score to DB
  fetch('/api/geogame/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location_name: target.location_name,
      winner: 'Player 1',
      points_awarded: points,
      zoom_level: currentZoom
    })
  });
  
  setTimeout(() => {
    currentRoundIndex++;
    startRound();
  }, 4000);
}

function endGame() {
  currentState = 'GAME_OVER';
  statusText.textContent = "Game Over!";
  document.getElementById('geogame-final-score').textContent = totalScore;
  document.getElementById('geogame-end-modal').classList.remove('hidden');
}

// ==========================================
// MAP RENDERING & UTILS
// ==========================================

function drawMap() {
  mapContainer.innerHTML = '';
  
  mapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mapSvg.setAttribute("id", "ottawa-map-svg");
  mapSvg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  mapSvg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  
  // Background Image
  const bgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
  bgImage.setAttribute("href", "/frontend/assets/ottawa_map_bg.png");
  bgImage.setAttribute("width", MAP_WIDTH);
  bgImage.setAttribute("height", MAP_HEIGHT);
  bgImage.setAttribute("preserveAspectRatio", "xMidYMid slice");
  mapSvg.appendChild(bgImage);
  
  mapContainer.appendChild(mapSvg);
}

function latLonToXY(lat, lon) {
  const x = ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * MAP_WIDTH;
  const y = MAP_HEIGHT - (((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * MAP_HEIGHT);
  return { x, y };
}

function drawReticle(x, y, className) {
  const reticle = document.createElement('div');
  reticle.className = `reticle ${className}`;
  reticle.style.left = `${(x / MAP_WIDTH) * 100}%`;
  reticle.style.top = `${(y / MAP_HEIGHT) * 100}%`;
  mapContainer.appendChild(reticle);
}

function clearPins() {
  const pins = mapContainer.querySelectorAll('.target-pin, .reticle, .proximity-ring');
  pins.forEach(p => p.remove());
}

function resetMapView() {
  if(mapSvg) {
    mapSvg.style.transform = `scale(1) translate(0px, 0px)`;
  }
}

function zoomMapTo(x, y, scale) {
  // Calculate transform origin to keep the clicked point centered
  // Transform origin is percentage based
  const originX = (x / MAP_WIDTH) * 100;
  const originY = (y / MAP_HEIGHT) * 100;
  
  mapSvg.style.transformOrigin = `${originX}% ${originY}%`;
  mapSvg.style.transform = `scale(${scale})`;
}
