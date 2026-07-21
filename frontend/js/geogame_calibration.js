// ==========================================
// CALIBRATION MODE UI
// ==========================================
import { MAP_WIDTH, MAP_HEIGHT, latLonToXY, xyToLatLon, calculateZoomViewBox } from './geogame_math.js?v=4.6';

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
  calibSvg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  calibSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  calibSvg.style.width = '100%';
  calibSvg.style.height = '100%';
  calibSvg.style.transition = 'viewBox 0.5s ease-out';
  
  const bgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
  bgImage.setAttribute("href", "/frontend/assets/ottawa_map_high_res.png");
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
  
  calibSvg.setAttribute('viewBox', `${vx} ${vy} ${zoomW} ${zoomH}`);
  
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
