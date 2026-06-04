// geogame.js - Ottawa GeoGame Logic
// Uses pre-built SVG map from real OpenStreetMap data

// ==========================================
// BOUNDING BOX - Must match convert_osm_to_svg.py exactly
// ==========================================
const MAP_BOUNDS = {
  minLon: -75.82,
  maxLon: -75.58,
  minLat: 45.31,
  maxLat: 45.46
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const MAP_PADDING = 20;

// ==========================================
// GAME STATE
// ==========================================
let currentState = 'IDLE';
let currentLocations = [];
let currentRoundIndex = 0;
let totalScore = 0;
let currentZoom = 0;
let timerInterval = null;

// DOM Elements
let container, mapContainer, mapSvg;
let locationDisplay, scoreDisplay, roundDisplay, statusText, timerFill;

// ==========================================
// INIT & LIFECYCLE
// ==========================================

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

  mapContainer.addEventListener('click', handleMapClick);
  loadMap();
}

export function startGeoGame() {
  if (currentState === 'IDLE' || currentState === 'GAME_OVER') {
    startNewGame();
  }
}

// ==========================================
// MAP LOADING - Fetch the pre-built SVG
// ==========================================

async function loadMap() {
  try {
    const response = await fetch('/frontend/assets/ottawa_map.svg');
    const svgText = await response.text();
    mapContainer.innerHTML = svgText;
    mapSvg = mapContainer.querySelector('svg');
    if (mapSvg) {
      mapSvg.setAttribute('id', 'ottawa-map-svg');
      mapSvg.style.width = '100%';
      mapSvg.style.height = '100%';
      mapSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      console.log('Ottawa map SVG loaded successfully');
    }
  } catch (e) {
    console.error('Failed to load map SVG:', e);
    statusText.textContent = 'Error loading map.';
  }
}

// ==========================================
// GAME LOOP
// ==========================================

async function startNewGame() {
  document.getElementById('geogame-end-modal').classList.add('hidden');
  totalScore = 0;
  currentRoundIndex = 0;
  currentZoom = 0;
  scoreDisplay.textContent = '0';
  statusText.textContent = "Loading locations...";
  
  // Clear old game pins from the SVG
  clearPins();
  resetMapView();
  
  try {
    const res = await fetch('/api/geogame/locations');
    const data = await res.json();
    if (data.status === 'success' && data.locations.length > 0) {
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
  statusText.textContent = `Click the map to guess! Worth ${loc.point_value} pts`;
  
  resetMapView();
  clearPins();
  startTimer(15);
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';
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
  statusText.textContent = "⏰ Time's up!";
  revealTarget(0);
}

function handleMapClick(e) {
  if (currentState !== 'GUESSING' || !mapSvg) return;
  clearInterval(timerInterval);
  
  // Get the SVG's bounding rect in screen pixels
  const rect = mapSvg.getBoundingClientRect();
  
  // Convert screen click to SVG viewBox coordinates
  const scaleX = MAP_WIDTH / rect.width;
  const scaleY = MAP_HEIGHT / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;
  
  // Convert SVG coordinates back to lat/lon using the same projection
  const guessLon = MAP_BOUNDS.minLon + ((clickX - MAP_PADDING) / (MAP_WIDTH - 2 * MAP_PADDING)) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const guessLat = MAP_BOUNDS.maxLat - ((clickY - MAP_PADDING) / (MAP_HEIGHT - 2 * MAP_PADDING)) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  
  checkGuess(guessLat, guessLon, clickX, clickY);
}

function checkGuess(guessLat, guessLon, clickX, clickY) {
  const target = currentLocations[currentRoundIndex];
  
  // Distance calc: 1° lat ≈ 111km, 1° lon ≈ 78km at 45°N
  const latDiff = (target.lat - guessLat) * 111;
  const lonDiff = (target.lon - guessLon) * 78;
  const distanceKm = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  
  // Draw player's guess crosshair
  drawGuessMarker(clickX, clickY);
  
  let pointsEarned = 0;
  if (distanceKm < 0.8) {
    pointsEarned = target.point_value;
    statusText.textContent = `🎯 Direct Hit! +${pointsEarned} pts (${(distanceKm * 1000).toFixed(0)}m)`;
    revealTarget(pointsEarned);
  } else if (distanceKm < 3.0 && currentZoom === 0) {
    statusText.textContent = `Near Miss (${distanceKm.toFixed(1)}km). Zooming in...`;
    pointsEarned = Math.floor(target.point_value / 2);
    setTimeout(() => {
      zoomMapTo(clickX, clickY, 2.5);
      currentZoom = 1;
      currentState = 'GUESSING';
      statusText.textContent = `Try again! Worth ${pointsEarned} pts`;
      startTimer(10);
    }, 1500);
  } else {
    statusText.textContent = `❌ Missed! (${distanceKm.toFixed(1)}km away)`;
    revealTarget(0);
  }
}

function revealTarget(points) {
  currentState = 'SCORING';
  const target = currentLocations[currentRoundIndex];
  
  totalScore += points;
  scoreDisplay.textContent = totalScore;
  
  const targetPt = latLonToXY(target.lat, target.lon);
  
  // Draw actual location marker on the SVG
  const pinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pinGroup.classList.add('game-pin');
  
  // Pulsing ring
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", targetPt.x);
  ring.setAttribute("cy", targetPt.y);
  ring.setAttribute("r", "18");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", points > 0 ? "#4ade80" : "#f87171");
  ring.setAttribute("stroke-width", "2");
  ring.setAttribute("opacity", "0.7");
  pinGroup.appendChild(ring);
  
  // Pin dot
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", targetPt.x);
  dot.setAttribute("cy", targetPt.y);
  dot.setAttribute("r", "6");
  dot.setAttribute("fill", points > 0 ? "#4ade80" : "#f87171");
  dot.setAttribute("stroke", "white");
  dot.setAttribute("stroke-width", "2");
  pinGroup.appendChild(dot);
  
  // Label
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", targetPt.x);
  label.setAttribute("y", targetPt.y - 24);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("fill", "white");
  label.setAttribute("font-size", "11");
  label.setAttribute("font-weight", "600");
  label.setAttribute("font-family", "Outfit, sans-serif");
  label.textContent = target.location_name.length > 30
    ? target.location_name.substring(0, 27) + '...'
    : target.location_name;
  pinGroup.appendChild(label);
  
  mapSvg.appendChild(pinGroup);
  
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
// PROJECTION & UTILITIES
// ==========================================

function latLonToXY(lat, lon) {
  const x = MAP_PADDING + ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * (MAP_WIDTH - 2 * MAP_PADDING);
  const y = MAP_PADDING + ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * (MAP_HEIGHT - 2 * MAP_PADDING);
  return { x, y };
}

function drawGuessMarker(x, y) {
  if (!mapSvg) return;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.classList.add('game-pin');
  
  const size = 12;
  const h = document.createElementNS("http://www.w3.org/2000/svg", "line");
  h.setAttribute("x1", x - size); h.setAttribute("y1", y);
  h.setAttribute("x2", x + size); h.setAttribute("y2", y);
  h.setAttribute("stroke", "#ef4444"); h.setAttribute("stroke-width", "2");
  group.appendChild(h);
  
  const v = document.createElementNS("http://www.w3.org/2000/svg", "line");
  v.setAttribute("x1", x); v.setAttribute("y1", y - size);
  v.setAttribute("x2", x); v.setAttribute("y2", y + size);
  v.setAttribute("stroke", "#ef4444"); v.setAttribute("stroke-width", "2");
  group.appendChild(v);
  
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", x); dot.setAttribute("cy", y);
  dot.setAttribute("r", "3");
  dot.setAttribute("fill", "#ef4444");
  group.appendChild(dot);
  
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
