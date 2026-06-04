const fs = require('fs');
let content = fs.readFileSync('frontend/js/geogame.js', 'utf8');

// 1. Add btn-geogame-calibrate event listener
content = content.replace(
  /document\.getElementById\('btn-geogame-restart'\)\.addEventListener\('click', \(\) => switchScreen\('intro'\)\);/,
  `document.getElementById('btn-geogame-restart').addEventListener('click', () => switchScreen('intro'));
  
  const calibBtn = document.getElementById('btn-geogame-calibrate');
  if (calibBtn) calibBtn.addEventListener('click', initCalibration);
  const exitCalibBtn = document.getElementById('btn-geogame-exit-calib');
  if (exitCalibBtn) exitCalibBtn.addEventListener('click', () => { switchScreen('intro'); if(calibSvg) calibSvg.remove(); });`
);

// 2. Add 'calibration' to switchScreen cases if we need?
// Wait, `switchScreen` just loops over Object.keys(screens) and adds/removes 'active'.
// I need to add 'calibration' to `screens`!
content = content.replace(
  /game: document\.getElementById\('geogame-game-screen'\)/,
  `game: document.getElementById('geogame-game-screen'),
    calibration: document.getElementById('geogame-calibration-screen')`
);

// 3. Inject Calibration Logic at the bottom of the file
const calibLogic = `
// ==========================================
// CALIBRATION MODE
// ==========================================
let calibSvg;
let calibLocations = [];
let currentCalibIndex = -1;
let calibPinGroup = null;

async function initCalibration() {
  switchScreen('calibration');
  document.getElementById('geogame-status-text').textContent = ""; // clear game status
  
  const container = document.getElementById('geogame-calib-map-container');
  container.innerHTML = '';
  
  calibSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  calibSvg.setAttribute("viewBox", \`0 0 \${MAP_WIDTH} \${MAP_HEIGHT}\`);
  calibSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  calibSvg.style.width = '100%';
  calibSvg.style.height = '100%';
  calibSvg.style.transition = 'transform 0.5s ease';
  
  const bgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
  bgImage.setAttribute("href", "/frontend/assets/ottawa_map_carto.png");
  bgImage.setAttribute("width", MAP_WIDTH);
  bgImage.setAttribute("height", MAP_HEIGHT);
  calibSvg.appendChild(bgImage);
  container.appendChild(calibSvg);
  
  // Event listeners for Map
  calibSvg.addEventListener('contextmenu', handleCalibRightClick);
  calibSvg.addEventListener('click', handleCalibLeftClick);
  
  // Fetch locations
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
     div.className = 'p-2 rounded cursor-pointer border border-gray-700 hover:bg-gray-700 text-sm';
     div.textContent = loc.location_name;
     if (i === currentCalibIndex) div.classList.add('bg-blue-600', 'border-blue-500');
     div.addEventListener('click', () => selectCalibLocation(i));
     list.appendChild(div);
  });
}

function selectCalibLocation(index) {
  currentCalibIndex = index;
  renderCalibList(); // update active styling
  
  const loc = calibLocations[index];
  const pt = latLonToXY(loc.lat, loc.lon);
  
  // Zoom Map
  const originX = (pt.x / MAP_WIDTH) * 100;
  const originY = (pt.y / MAP_HEIGHT) * 100;
  calibSvg.style.transformOrigin = \`\${originX}% \${originY}%\`;
  calibSvg.style.transform = \`scale(4.0)\`;
  
  // Draw Pin
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
  
  // Update UI instantly
  loc.lat = newLatLon.lat;
  loc.lon = newLatLon.lon;
  selectCalibLocation(currentCalibIndex);
  
  // Show status
  const status = document.getElementById('geogame-calib-status');
  status.textContent = "Saving...";
  status.classList.remove('hidden');
  
  // API Call
  await fetch('/api/geogame/locations/update', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
        id: loc.id,
        lat: loc.lat,
        lon: loc.lon
     })
  });
  
  status.textContent = "Saved ✓";
  status.classList.add('text-green-400');
  setTimeout(() => {
     status.classList.add('hidden');
     status.classList.remove('text-green-400');
  }, 1000);
}

function handleCalibLeftClick(e) {
  if (currentCalibIndex === -1) return;
  
  // Show "Confirmed"
  const status = document.getElementById('geogame-calib-status');
  status.textContent = "Confirmed ✓";
  status.classList.remove('hidden');
  status.classList.add('text-blue-400');
  setTimeout(() => {
     status.classList.add('hidden');
     status.classList.remove('text-blue-400');
  }, 1000);
  
  // Move to next
  if (currentCalibIndex < calibLocations.length - 1) {
     selectCalibLocation(currentCalibIndex + 1);
     // Scroll list to item
     const list = document.getElementById('geogame-calib-list');
     const item = list.children[currentCalibIndex];
     if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
`;

content += '\n' + calibLogic;

fs.writeFileSync('frontend/js/geogame.js', content);
console.log('Updated geogame.js with Calibration logic');
