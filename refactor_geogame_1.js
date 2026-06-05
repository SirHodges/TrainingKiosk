const fs = require('fs');

let geogame = fs.readFileSync('geogame_backup.js', 'utf8');

// 1. CREATE geogame_math.js
const geogameMath = `
// ==========================================
// GEOGAME MATH & PROJECTION
// ==========================================

export const MAP_BOUNDS = {
  minLat: 45.1,
  maxLat: 45.6,
  minLon: -76.1,
  maxLon: -75.3
};

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 800;

export function latLonToXY(lat, lon) {
  const x = ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * MAP_WIDTH;
  const yMin = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.minLat * Math.PI / 180) / 2));
  const yMax = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.maxLat * Math.PI / 180) / 2));
  const yMerc = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const y = MAP_HEIGHT - ((yMerc - yMin) / (yMax - yMin)) * MAP_HEIGHT;
  return { x, y };
}

export function xyToLatLon(x, y) {
  const lon = MAP_BOUNDS.minLon + (x / MAP_WIDTH) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const yMin = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.minLat * Math.PI / 180) / 2));
  const yMax = Math.log(Math.tan(Math.PI / 4 + (MAP_BOUNDS.maxLat * Math.PI / 180) / 2));
  const yMerc = yMin + ((MAP_HEIGHT - y) / MAP_HEIGHT) * (yMax - yMin);
  const lat = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI;
  return { lat, lon };
}

export function calculatePoints(distKm) {
  if (distKm > 4.0) return 0;
  const distM = distKm * 1000;
  if (distM <= 50) return 100;
  const raw = 5000 / distM;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const latDiff = (lat2 - lat1) * 111;
  const lonDiff = (lon2 - lon1) * 78;
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
}

/**
 * Calculates a new viewBox representing a zoomed area that bounds the two given coordinates.
 * Returns { x, y, width, height, center }
 */
export function calculateZoomViewBox(x1, y1, x2, y2, currentZoomLevel) {
  const padding = 100; // pixels
  let minX = Math.min(x1, x2) - padding;
  let maxX = Math.max(x1, x2) + padding;
  let minY = Math.min(y1, y2) - padding;
  let maxY = Math.max(y1, y2) + padding;
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Calculate aspect ratio corrections so the viewBox doesn't distort
  const targetRatio = MAP_WIDTH / MAP_HEIGHT;
  const currentRatio = width / height;
  
  let finalWidth = width;
  let finalHeight = height;
  
  if (currentRatio > targetRatio) {
      // wider than map, so expand height
      finalHeight = width / targetRatio;
  } else {
      // taller than map, so expand width
      finalWidth = height * targetRatio;
  }
  
  // Constrain max zoom scale (cap at roughly 20x zoom = 60px width)
  const minAllowedWidth = MAP_WIDTH / 20.0;
  if (finalWidth < minAllowedWidth) {
      finalWidth = minAllowedWidth;
      finalHeight = minAllowedWidth / targetRatio;
  }
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  let finalX = centerX - finalWidth / 2;
  let finalY = centerY - finalHeight / 2;
  
  // Clamp to map boundaries
  if (finalX < 0) finalX = 0;
  if (finalY < 0) finalY = 0;
  if (finalX + finalWidth > MAP_WIDTH) finalX = MAP_WIDTH - finalWidth;
  if (finalY + finalHeight > MAP_HEIGHT) finalY = MAP_HEIGHT - finalHeight;
  
  return { 
     x: finalX, 
     y: finalY, 
     width: finalWidth, 
     height: finalHeight,
     center: { x: centerX, y: centerY }
  };
}
`;
fs.writeFileSync('frontend/js/geogame_math.js', geogameMath.trim());
console.log('Created geogame_math.js');


// 2. CREATE geogame_calibration.js
const geogameCalibration = `
// ==========================================
// CALIBRATION MODE UI
// ==========================================
import { MAP_WIDTH, MAP_HEIGHT, latLonToXY, xyToLatLon, calculateZoomViewBox } from './geogame_math.js';

let calibSvg;
let calibPinGroup;
let calibLocations = [];
let currentCalibIndex = -1;
let switchScreenRef;

export async function initCalibration(switchScreenFunc) {
  switchScreenRef = switchScreenFunc;
  switchScreenRef('calibration');
  document.getElementById('geogame-status-text').textContent = ""; 
  
  const container = document.getElementById('geogame-calib-map-container');
  container.innerHTML = '';
  
  calibSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  calibSvg.setAttribute("viewBox", \`0 0 \${MAP_WIDTH} \${MAP_HEIGHT}\`);
  calibSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  calibSvg.style.width = '100%';
  calibSvg.style.height = '100%';
  calibSvg.style.transition = 'viewBox 0.5s ease-out';
  
  const bgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
  bgImage.setAttribute("href", "/frontend/assets/ottawa_map_carto.png");
  bgImage.setAttribute("width", MAP_WIDTH);
  bgImage.setAttribute("height", MAP_HEIGHT);
  calibSvg.appendChild(bgImage);
  container.appendChild(calibSvg);
  
  calibSvg.addEventListener('contextmenu', handleCalibRightClick);
  calibSvg.addEventListener('click', handleCalibLeftClick);
  
  const res = await fetch('/api/geogame/locations/all');
  const data = await res.json();
  if (data.status === 'success') {
     calibLocations = data.locations;
     renderCalibList();
  }
}

function renderCalibList() {
  const list = document.getElementById('geogame-calib-list');
  list.innerHTML = '';
  calibLocations.forEach((loc, i) => {
     const div = document.createElement('div');
     div.className = 'calib-list-item';
     div.textContent = loc.location_name;
     if (i === currentCalibIndex) div.classList.add('active');
     div.addEventListener('click', () => selectCalibLocation(i));
     list.appendChild(div);
  });
}

function selectCalibLocation(index) {
  currentCalibIndex = index;
  renderCalibList(); 
  
  const loc = calibLocations[index];
  const pt = latLonToXY(loc.lat, loc.lon);
  
  // Use viewBox zoom (simulating a 4x zoom around the point)
  const zoomW = MAP_WIDTH / 4.0;
  const zoomH = MAP_HEIGHT / 4.0;
  let vx = pt.x - zoomW/2;
  let vy = pt.y - zoomH/2;
  
  // clamp
  if (vx < 0) vx = 0;
  if (vy < 0) vy = 0;
  if (vx + zoomW > MAP_WIDTH) vx = MAP_WIDTH - zoomW;
  if (vy + zoomH > MAP_HEIGHT) vy = MAP_HEIGHT - zoomH;
  
  calibSvg.setAttribute('viewBox', \`\${vx} \${vy} \${zoomW} \${zoomH}\`);
  
  if (calibPinGroup) calibPinGroup.remove();
  calibPinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y);
  c.setAttribute("r", "4"); c.setAttribute("fill", "#22c55e");
  calibPinGroup.appendChild(c);
  
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", pt.x); ring.setAttribute("cy", pt.y);
  ring.setAttribute("r", "12"); ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "#22c55e"); ring.setAttribute("stroke-width", "2");
  calibPinGroup.appendChild(ring);
  
  calibSvg.appendChild(calibPinGroup);
}

async function handleCalibRightClick(e) {
  e.preventDefault();
  if (currentCalibIndex === -1) return;
  
  const pt = calibSvg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgP = pt.matrixTransform(calibSvg.getScreenCTM().inverse());
  
  const loc = calibLocations[currentCalibIndex];
  const newLatLon = xyToLatLon(svgP.x, svgP.y);
  
  loc.lat = newLatLon.lat;
  loc.lon = newLatLon.lon;
  selectCalibLocation(currentCalibIndex);
  
  const status = document.getElementById('geogame-calib-status');
  status.textContent = "Saving...";
  status.classList.add('active');
  
  await fetch('/api/geogame/locations/update', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ id: loc.id, lat: loc.lat, lon: loc.lon })
  });
  
  status.textContent = "Saved ✓";
  status.classList.add('success'); status.classList.remove('info');
  setTimeout(() => {
     status.classList.remove('active');
     status.classList.remove('success');
  }, 1000);
}

function handleCalibLeftClick(e) {
  if (currentCalibIndex === -1) return;
  
  const status = document.getElementById('geogame-calib-status');
  status.textContent = "Confirmed ✓";
  status.classList.add('active');
  status.classList.add('info'); status.classList.remove('success');
  setTimeout(() => {
     status.classList.remove('active');
     status.classList.remove('info');
  }, 1000);
  
  if (currentCalibIndex < calibLocations.length - 1) {
     selectCalibLocation(currentCalibIndex + 1);
     const list = document.getElementById('geogame-calib-list');
     const item = list.children[currentCalibIndex];
     if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export function exitCalibration() {
    if (switchScreenRef) switchScreenRef('intro');
    if (calibSvg) calibSvg.remove();
}
`;
fs.writeFileSync('frontend/js/geogame_calibration.js', geogameCalibration.trim());
console.log('Created geogame_calibration.js');
