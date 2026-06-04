const fs = require('fs');

// 1. Fix HTML structure
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Extract the calibration screen from wherever it is
const calibRegex = /<div id="geogame-calibration-screen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
let calibScreenHtml = "";
const match = html.match(calibRegex);
if (match) {
   calibScreenHtml = match[0];
   html = html.replace(calibRegex, ''); // Remove it from the Quiz section
} else {
   console.log("Could not find calibration screen in HTML");
}

// Ensure calibScreenHtml has correct closing tags (it should be 3 divs: container, sidebar, header).
// Wait! The regex /<div id="geogame-calibration-screen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/ 
// The actual screen has:
/*
<div id="geogame-calibration-screen" class="geogame-screen">
      <!-- Sidebar -->
      <div id="geogame-calib-sidebar">
        <div id="geogame-calib-sidebar-header">
           <h2>Calibration</h2>
           <button id="btn-geogame-exit-calib">Exit</button>
        </div>
        <div id="geogame-calib-instructions">...</div>
        <div id="geogame-calib-list" class="custom-scrollbar">...</div>
      </div>
      <!-- Map Area -->
      <div id="geogame-calib-map-container">
         <div id="geogame-calib-status"></div>
      </div>
</div>
*/
// Let's just redefine the calibScreen html string to be 100% safe.
calibScreenHtml = `
    <!-- CALIBRATION SCREEN -->
    <div id="geogame-calibration-screen" class="geogame-screen">
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
    </div>
`;

// Inject into GeoGame mode, specifically before <div id="geogame-countdown-screen"
if (!html.includes('id="geogame-calibration-screen"')) {
   html = html.replace('<div id="geogame-countdown-screen"', calibScreenHtml + '\n    <div id="geogame-countdown-screen"');
}

// 2. Change the button to be yellow and say "Map Calibration"
const newBtn = `<button id="btn-geogame-calibrate" title="Calibrate Locations" style="background: var(--color-warning); color: #000; font-weight: bold; padding: 10px 20px; border-radius: 8px; border: none; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">Map Calibration</button>`;

html = html.replace(/<button id="btn-geogame-calibrate" title="Calibrate Locations">[\s\S]*?<\/button>/, newBtn);

fs.writeFileSync('frontend/index.html', html);
console.log('Fixed HTML layout and button styling');

// 3. Fix CSS in geogame.css for the button (we will just remove the old custom CSS for the button so inline styles take over, or update the custom CSS)
let css = fs.readFileSync('frontend/css/geogame.css', 'utf8');
css = css.replace(/#btn-geogame-calibrate \{[\s\S]*?#btn-geogame-calibrate svg \{[\s\S]*?\}/, `
#btn-geogame-calibrate {
  position: absolute;
  bottom: 20px;
  right: 20px;
  cursor: pointer;
  z-index: 100;
  transition: transform 0.2s;
}
#btn-geogame-calibrate:hover {
  transform: scale(1.05);
}
`);

fs.writeFileSync('frontend/css/geogame.css', css);
console.log('Fixed CSS');
