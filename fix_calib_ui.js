const fs = require('fs');

// 1. Add CSS to geogame.css
let css = fs.readFileSync('frontend/css/geogame.css', 'utf8');

const calibCss = `
/* Calibration UI */
#btn-geogame-calibrate {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: none;
  padding: 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  z-index: 100;
  transition: color 0.2s, background 0.2s;
}
#btn-geogame-calibrate:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}
#btn-geogame-calibrate svg {
  width: 24px;
  height: 24px;
}

#geogame-calibration-screen {
  display: none;
  flex-direction: row;
  background: var(--bg-primary);
  color: var(--text-primary);
  width: 100%;
  height: 100%;
}
#geogame-calibration-screen.active {
  display: flex !important;
}

#geogame-calib-sidebar {
  width: 320px;
  height: 100%;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

#geogame-calib-sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#geogame-calib-sidebar-header h2 { margin: 0; font-size: 1.2rem; }
#btn-geogame-exit-calib {
  background: transparent;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  font-weight: bold;
}

#geogame-calib-instructions {
  padding: 12px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  line-height: 1.4;
}

#geogame-calib-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.calib-list-item {
  padding: 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}
.calib-list-item:hover { background: var(--bg-tertiary); }
.calib-list-item.active {
  background: var(--accent-primary);
  border-color: var(--accent-secondary);
  color: #fff;
}

#geogame-calib-map-container {
  flex: 1;
  height: 100%;
  position: relative;
  background: #111;
  overflow: hidden;
  cursor: crosshair;
}

#geogame-calib-status {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1.2rem;
  font-weight: bold;
  z-index: 10;
  display: none;
}
#geogame-calib-status.active { display: block; }
#geogame-calib-status.success { color: var(--color-success); }
#geogame-calib-status.info { color: var(--accent-primary); }
`;

if (!css.includes('#btn-geogame-calibrate')) {
  css += '\n' + calibCss;
  fs.writeFileSync('frontend/css/geogame.css', css);
  console.log('Updated geogame.css');
}

// 2. Update index.html to remove tailwind classes and use our IDs
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Replace Button
html = html.replace(
  /<button id="btn-geogame-calibrate" class="[^"]+" title="Calibrate Locations">/,
  '<button id="btn-geogame-calibrate" title="Calibrate Locations">'
);

// Replace Screen layout
const oldScreenRegex = /<div id="geogame-calibration-screen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newScreen = `<div id="geogame-calibration-screen" class="geogame-screen">
      <!-- Sidebar -->
      <div id="geogame-calib-sidebar">
        <div id="geogame-calib-sidebar-header">
           <h2>Calibration</h2>
           <button id="btn-geogame-exit-calib">Exit</button>
        </div>
        <div id="geogame-calib-instructions">
          <b>Left click list</b>: Zoom to location<br>
          <b>Right click map</b>: Set new coordinates<br>
          <b>Left click map</b>: Confirm & Next
        </div>
        <div id="geogame-calib-list" class="custom-scrollbar">
           <!-- Populated via JS -->
        </div>
      </div>
      <!-- Map Area -->
      <div id="geogame-calib-map-container">
         <div id="geogame-calib-status"></div>
      </div>
    </div>`;

if (html.includes('id="geogame-calibration-screen"')) {
   html = html.replace(oldScreenRegex, newScreen);
   fs.writeFileSync('frontend/index.html', html);
   console.log('Updated index.html');
}

// 3. Update geogame.js to use the new CSS classes instead of Tailwind
let js = fs.readFileSync('frontend/js/geogame.js', 'utf8');

// Remove tailwind from list items
js = js.replace(
  /div\.className = 'p-2 rounded cursor-pointer border border-gray-700 hover:bg-gray-700 text-sm';/g,
  `div.className = 'calib-list-item';`
);

js = js.replace(
  /if \(i === currentCalibIndex\) div\.classList\.add\('bg-blue-600', 'border-blue-500'\);/g,
  `if (i === currentCalibIndex) div.classList.add('active');`
);

// Remove tailwind from status
js = js.replace(
  /status\.classList\.remove\('hidden'\);/g,
  `status.classList.add('active');`
);
js = js.replace(
  /status\.classList\.add\('hidden'\);/g,
  `status.classList.remove('active');`
);

js = js.replace(
  /status\.classList\.add\('text-green-400'\);/g,
  `status.classList.add('success'); status.classList.remove('info');`
);
js = js.replace(
  /status\.classList\.remove\('text-green-400'\);/g,
  `status.classList.remove('success');`
);

js = js.replace(
  /status\.classList\.add\('text-blue-400'\);/g,
  `status.classList.add('info'); status.classList.remove('success');`
);
js = js.replace(
  /status\.classList\.remove\('text-blue-400'\);/g,
  `status.classList.remove('info');`
);

fs.writeFileSync('frontend/js/geogame.js', js);
console.log('Updated geogame.js');
