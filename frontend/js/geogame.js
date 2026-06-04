// geogame.js - Ottawa GeoGame Logic
// Complete rewrite with geographically accurate SVG map

// ==========================================
// BOUNDING BOX - Tighter focus on urban Ottawa
// ==========================================
// West: past Queensway Carleton (~-75.82)
// East: past Montfort (~-75.58)
// North: past Gatineau shore (~45.46)
// South: past Queensway Carleton (~45.31)
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
// REAL GEOGRAPHIC DATA - Ottawa features traced from actual coordinates
// ==========================================

// Ottawa River - south bank shoreline (Ontario side), west to east
const OTTAWA_RIVER_SOUTH_BANK = [
  [45.389, -75.82],
  [45.390, -75.80],
  [45.395, -75.78],
  [45.400, -75.76],
  [45.405, -75.74],
  [45.410, -75.73],
  [45.414, -75.72],
  [45.418, -75.715],
  [45.420, -75.710],
  [45.424, -75.705], // Parliament area
  [45.428, -75.700],
  [45.432, -75.695],
  [45.435, -75.690],
  [45.437, -75.685],
  [45.440, -75.675],
  [45.443, -75.665],
  [45.446, -75.655],
  [45.448, -75.645],
  [45.450, -75.635],
  [45.452, -75.625],
  [45.453, -75.615],
  [45.455, -75.600],
  [45.456, -75.590],
  [45.458, -75.580]
];

// Ottawa River - north bank (Gatineau side)
const OTTAWA_RIVER_NORTH_BANK = [
  [45.400, -75.82],
  [45.405, -75.80],
  [45.410, -75.78],
  [45.418, -75.76],
  [45.425, -75.74],
  [45.430, -75.73],
  [45.434, -75.72],
  [45.438, -75.715],
  [45.440, -75.710],
  [45.443, -75.705],
  [45.446, -75.700],
  [45.449, -75.695],
  [45.452, -75.690],
  [45.454, -75.685],
  [45.456, -75.675],
  [45.458, -75.665],
  [45.459, -75.655],
  [45.460, -75.645],
  [45.460, -75.635],
  [45.460, -75.625],
  [45.460, -75.615],
  [45.460, -75.600],
  [45.460, -75.590],
  [45.460, -75.580]
];

// Rideau Canal - from Ottawa River south to Dow's Lake area
const RIDEAU_CANAL = [
  [45.426, -75.695], // Locks at Ottawa River
  [45.424, -75.694],
  [45.422, -75.693],
  [45.420, -75.693],
  [45.418, -75.692],
  [45.415, -75.691],
  [45.412, -75.690],
  [45.408, -75.690],
  [45.405, -75.691],
  [45.402, -75.692],
  [45.399, -75.694],
  [45.396, -75.697],
  [45.393, -75.700],
  [45.390, -75.705], // Dow's Lake area
  [45.387, -75.710],
  [45.384, -75.715]
];

// Rideau River - flows from south through the east side
const RIDEAU_RIVER = [
  [45.310, -75.650],
  [45.315, -75.648],
  [45.320, -75.650],
  [45.325, -75.652],
  [45.330, -75.655],
  [45.335, -75.658],
  [45.340, -75.660],
  [45.345, -75.661],
  [45.350, -75.660],
  [45.355, -75.658],
  [45.360, -75.656],
  [45.365, -75.654],
  [45.370, -75.653],
  [45.375, -75.652],
  [45.380, -75.651],
  [45.385, -75.650],
  [45.390, -75.650],
  [45.395, -75.652],
  [45.400, -75.656],
  [45.405, -75.660],
  [45.410, -75.665],
  [45.415, -75.670],
  [45.420, -75.680],
  [45.424, -75.690],
  [45.426, -75.695] // Meets canal/Ottawa River
];

// Highway 417 (Queensway) - main east-west through Ottawa
const HWY_417 = [
  [45.345, -75.82],
  [45.345, -75.80],
  [45.348, -75.78],
  [45.352, -75.76],
  [45.358, -75.74],
  [45.365, -75.72],
  [45.375, -75.71],
  [45.385, -75.70],
  [45.392, -75.69],
  [45.398, -75.68],
  [45.403, -75.67],
  [45.408, -75.66],
  [45.413, -75.65],
  [45.418, -75.64],
  [45.425, -75.63],
  [45.430, -75.62],
  [45.435, -75.61],
  [45.440, -75.60],
  [45.445, -75.59],
  [45.448, -75.58]
];

// Highway 416 - goes south from the 417
const HWY_416 = [
  [45.345, -75.82],
  [45.340, -75.82],
  [45.335, -75.82],
  [45.330, -75.82],
  [45.325, -75.82],
  [45.320, -75.82],
  [45.315, -75.82],
  [45.310, -75.82]
];

// Neighbourhood labels with positions
const NEIGHBOURHOOD_LABELS = [
  { name: "Kanata", lat: 45.345, lon: -75.80 },
  { name: "Westboro", lat: 45.395, lon: -75.745 },
  { name: "Centretown", lat: 45.415, lon: -75.700 },
  { name: "ByWard Mkt", lat: 45.430, lon: -75.692 },
  { name: "Glebe", lat: 45.400, lon: -75.693 },
  { name: "Alta Vista", lat: 45.390, lon: -75.660 },
  { name: "Vanier", lat: 45.435, lon: -75.660 },
  { name: "Barrhaven", lat: 45.320, lon: -75.76 },
  { name: "Gatineau", lat: 45.450, lon: -75.72 },
  { name: "Sandy Hill", lat: 45.422, lon: -75.680 },
  { name: "LeBreton", lat: 45.416, lon: -75.718 },
  { name: "Dow's Lake", lat: 45.393, lon: -75.705 }
];

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
  drawMap();
}

export function startGeoGame() {
  if (currentState === 'IDLE' || currentState === 'GAME_OVER') {
    startNewGame();
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
  
  // Redraw map fresh (clears old pins)
  drawMap();
  
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
  statusText.textContent = "Time's up!";
  revealTarget(0);
}

function handleMapClick(e) {
  if (currentState !== 'GUESSING') return;
  clearInterval(timerInterval);
  
  const rect = mapSvg.getBoundingClientRect();
  const scaleX = MAP_WIDTH / rect.width;
  const scaleY = MAP_HEIGHT / rect.height;
  
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;
  
  const guessLon = MAP_BOUNDS.minLon + (clickX / MAP_WIDTH) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const guessLat = MAP_BOUNDS.maxLat - (clickY / MAP_HEIGHT) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  
  checkGuess(guessLat, guessLon, clickX, clickY);
}

function checkGuess(guessLat, guessLon, clickX, clickY) {
  const target = currentLocations[currentRoundIndex];
  
  const latDiff = (target.lat - guessLat) * 111;
  const lonDiff = (target.lon - guessLon) * 78;
  const distanceKm = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  
  // Draw player guess
  drawGuessMarker(clickX, clickY);
  
  let pointsEarned = 0;
  if (distanceKm < 0.8) {
    pointsEarned = target.point_value;
    statusText.textContent = `🎯 Direct Hit! +${pointsEarned} Points (${(distanceKm * 1000).toFixed(0)}m)`;
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
  
  // Draw the real location marker on the SVG
  const pinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pinGroup.classList.add('svg-target-pin');
  
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
  label.textContent = target.location_name.length > 25 
    ? target.location_name.substring(0, 22) + '...' 
    : target.location_name;
  pinGroup.appendChild(label);
  
  mapSvg.appendChild(pinGroup);
  
  // Save score
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
// MAP RENDERING - All geo-accurate SVG
// ==========================================

function drawMap() {
  mapContainer.innerHTML = '';
  
  mapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mapSvg.setAttribute("id", "ottawa-map-svg");
  mapSvg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  mapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  mapSvg.style.width = '100%';
  mapSvg.style.height = '100%';
  
  // Dark background
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", MAP_WIDTH);
  bg.setAttribute("height", MAP_HEIGHT);
  bg.setAttribute("fill", "#0f1923");
  mapSvg.appendChild(bg);
  
  // Grid lines for reference (subtle)
  drawGrid();
  
  // Ottawa River (filled shape between north & south banks)
  drawRiver();
  
  // Rideau Canal
  drawPolyline(RIDEAU_CANAL, "#3b82f6", 4, "0.6");
  
  // Rideau River
  drawPolyline(RIDEAU_RIVER, "#2563eb", 3, "0.4");
  
  // Highways
  drawPolyline(HWY_417, "#fbbf24", 2, "0.4");
  drawPolyline(HWY_416, "#fbbf24", 2, "0.3");
  
  // Highway labels
  drawHwyLabel(45.398, -75.68, "417");
  drawHwyLabel(45.330, -75.815, "416");
  
  // Neighbourhood labels
  NEIGHBOURHOOD_LABELS.forEach(n => {
    drawNeighbourhoodLabel(n.lat, n.lon, n.name);
  });
  
  mapContainer.appendChild(mapSvg);
}

function drawGrid() {
  // Draw subtle lat/lon grid lines
  const gridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gridGroup.setAttribute("opacity", "0.08");
  
  // Longitude lines every 0.02 degrees
  for (let lon = -75.82; lon <= -75.58; lon += 0.02) {
    const p1 = latLonToXY(MAP_BOUNDS.maxLat, lon);
    const p2 = latLonToXY(MAP_BOUNDS.minLat, lon);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
    line.setAttribute("stroke", "#ffffff");
    line.setAttribute("stroke-width", "0.5");
    gridGroup.appendChild(line);
  }
  
  // Latitude lines every 0.02 degrees
  for (let lat = 45.31; lat <= 45.46; lat += 0.02) {
    const p1 = latLonToXY(lat, MAP_BOUNDS.minLon);
    const p2 = latLonToXY(lat, MAP_BOUNDS.maxLon);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
    line.setAttribute("stroke", "#ffffff");
    line.setAttribute("stroke-width", "0.5");
    gridGroup.appendChild(line);
  }
  
  mapSvg.appendChild(gridGroup);
}

function drawRiver() {
  // Create a filled polygon between north and south banks
  const southPoints = OTTAWA_RIVER_SOUTH_BANK.map(c => {
    const p = latLonToXY(c[0], c[1]);
    return `${p.x},${p.y}`;
  });
  const northPoints = OTTAWA_RIVER_NORTH_BANK.slice().reverse().map(c => {
    const p = latLonToXY(c[0], c[1]);
    return `${p.x},${p.y}`;
  });
  
  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", [...southPoints, ...northPoints].join(' '));
  polygon.setAttribute("fill", "#1e3a5f");
  polygon.setAttribute("stroke", "#2563eb");
  polygon.setAttribute("stroke-width", "1");
  polygon.setAttribute("opacity", "0.7");
  mapSvg.appendChild(polygon);
  
  // Label
  const mid = latLonToXY(45.440, -75.72);
  const riverLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  riverLabel.setAttribute("x", mid.x);
  riverLabel.setAttribute("y", mid.y);
  riverLabel.setAttribute("text-anchor", "middle");
  riverLabel.setAttribute("fill", "#60a5fa");
  riverLabel.setAttribute("font-size", "13");
  riverLabel.setAttribute("font-style", "italic");
  riverLabel.setAttribute("font-family", "Outfit, sans-serif");
  riverLabel.setAttribute("opacity", "0.6");
  riverLabel.textContent = "Ottawa River";
  mapSvg.appendChild(riverLabel);
}

function drawPolyline(coords, color, width, opacity) {
  const points = coords.map(c => {
    const p = latLonToXY(c[0], c[1]);
    return `${p.x},${p.y}`;
  }).join(' ');
  
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", width);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("opacity", opacity);
  mapSvg.appendChild(line);
}

function drawHwyLabel(lat, lon, text) {
  const pt = latLonToXY(lat, lon);
  
  // Shield background
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", pt.x - 14);
  rect.setAttribute("y", pt.y - 9);
  rect.setAttribute("width", 28);
  rect.setAttribute("height", 18);
  rect.setAttribute("rx", 3);
  rect.setAttribute("fill", "#78350f");
  rect.setAttribute("stroke", "#fbbf24");
  rect.setAttribute("stroke-width", "1");
  rect.setAttribute("opacity", "0.8");
  mapSvg.appendChild(rect);
  
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", pt.x);
  label.setAttribute("y", pt.y + 4);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("fill", "#fbbf24");
  label.setAttribute("font-size", "11");
  label.setAttribute("font-weight", "bold");
  label.setAttribute("font-family", "Outfit, sans-serif");
  label.textContent = text;
  mapSvg.appendChild(label);
}

function drawNeighbourhoodLabel(lat, lon, name) {
  const pt = latLonToXY(lat, lon);
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", pt.x);
  label.setAttribute("y", pt.y);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("fill", "#94a3b8");
  label.setAttribute("font-size", "11");
  label.setAttribute("font-weight", "400");
  label.setAttribute("font-family", "Outfit, sans-serif");
  label.setAttribute("opacity", "0.5");
  label.textContent = name;
  mapSvg.appendChild(label);
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
  // Draw directly on the SVG so it stays in coordinate space
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.classList.add('svg-guess-pin');
  
  // Crosshair lines
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
  mapSvg.querySelectorAll('.svg-target-pin, .svg-guess-pin').forEach(p => p.remove());
}

function resetMapView() {
  if (mapSvg) {
    mapSvg.style.transform = 'none';
    mapSvg.style.transformOrigin = 'center center';
  }
}

function zoomMapTo(x, y, scale) {
  const originX = (x / MAP_WIDTH) * 100;
  const originY = (y / MAP_HEIGHT) * 100;
  mapSvg.style.transformOrigin = `${originX}% ${originY}%`;
  mapSvg.style.transform = `scale(${scale})`;
}
