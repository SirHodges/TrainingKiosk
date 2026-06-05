const fs = require('fs');

let js = fs.readFileSync('geogame_backup.js', 'utf8');

// 1. ADD IMPORTS AT TOP
js = `import { MAP_WIDTH, MAP_HEIGHT, latLonToXY, xyToLatLon, calculatePoints, calculateDistance, calculateZoomViewBox } from './geogame_math.js';\nimport { initCalibration, exitCalibration } from './geogame_calibration.js';\n` + js;

// Remove the old math constants
js = js.replace(/export const MAP_BOUNDS = \{[\s\S]*?maxLon: -75\.3 \};\n/, '');
js = js.replace(/export const MAP_WIDTH = 1200;\nexport const MAP_HEIGHT = 800;\n/, '');

// Remove Math functions specifically
const mathFuncsToRemove = [
  /function latLonToXY\(lat, lon\) \{[\s\S]*?return \{ x, y \};\n\}/,
  /function xyToLatLon\(x, y\) \{[\s\S]*?return \{ lat, lon \};\n\}/,
  /function calculatePoints\(distKm\) \{[\s\S]*?return Math\.max\(0, Math\.min\(100, Math\.round\(raw\)\)\);\n\}/,
  /function calculateDistance\(lat1, lon1, lat2, lon2\) \{[\s\S]*?return Math\.sqrt\(latDiff \* latDiff \+ lonDiff \* lonDiff\);\n\}/,
  /function zoomMapToBounds\(x1, y1, x2, y2\) \{[\s\S]*?return \{ x: centerX, y: centerY \};\n\}/
];

mathFuncsToRemove.forEach(regex => {
  js = js.replace(regex, '');
});

// Remove old Calibration block entirely
js = js.replace(/\/\/ ==========================================\n\/\/ CALIBRATION MODE\n\/\/ ==========================================\n[\s\S]*$/, '');

// 2. Map Setup: Add <g id="pins-layer">
js = js.replace(
  /mapSvg\.appendChild\(bgImage\);\n  mapContainer\.appendChild\(mapSvg\);/,
  `mapSvg.appendChild(bgImage);
  
  const pinsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pinsLayer.setAttribute("id", "pins-layer");
  mapSvg.appendChild(pinsLayer);
  
  mapContainer.appendChild(mapSvg);`
);

// 3. Fix drawGuessMarker and clearPins to use pins-layer
js = js.replace(
  /mapSvg\.appendChild\(group\);\n  return group;/,
  `const pinsLayer = document.getElementById("pins-layer");
  if (pinsLayer) pinsLayer.appendChild(group);
  else mapSvg.appendChild(group);
  return group;`
);

js = js.replace(
  /function clearPins\(\) \{[\s\S]*?\}/,
  `function clearPins() {
  const pinsLayer = document.getElementById("pins-layer");
  if (pinsLayer) pinsLayer.innerHTML = '';
}`
);

// 4. Update Calibration Button Bindings to use imported function
js = js.replace(
  /const calibBtn = document\.getElementById\('btn-geogame-calibrate'\);\n  if \(calibBtn\) calibBtn\.addEventListener\('click', initCalibration\);\n  const exitCalibBtn = document\.getElementById\('btn-geogame-exit-calib'\);\n  if \(exitCalibBtn\) exitCalibBtn\.addEventListener\('click', \(\) => \{ switchScreen\('intro'\); if\(calibSvg\) calibSvg\.remove\(\); \}\);/,
  `const calibBtn = document.getElementById('btn-geogame-calibrate');
  if (calibBtn) calibBtn.addEventListener('click', () => initCalibration(switchScreen));
  const exitCalibBtn = document.getElementById('btn-geogame-exit-calib');
  if (exitCalibBtn) exitCalibBtn.addEventListener('click', exitCalibration);`
);

// 5. Add \`isTransitioning\` state flag to prevent Race Conditions
js = js.replace(
  /let p1LockMessage = "Wild Guess!";\nlet p2LockMessage = "Wild Guess!";/,
  `let p1LockMessage = "Wild Guess!";
let p2LockMessage = "Wild Guess!";
let isTransitioning = false;`
);

// Ignore gamepad if transitioning
js = js.replace(
  /if \(currentState !== 'GUESSING' \|\| inputMode !== 'gamepad'\) return;/,
  `if (currentState !== 'GUESSING' || inputMode !== 'gamepad' || isTransitioning) return;`
);

// Ignore evaluates if transitioning
js = js.replace(
  /function evaluateGuesses\(\) \{/,
  `function evaluateGuesses() {
  if (isTransitioning) return;`
);

// Ignore timer expiry if transitioning
js = js.replace(
  /if \(playerCount === 2\) \{\n     \/\/ If timer runs out, evaluate whoever guessed!\n     evaluateClosestWins\(target\);\n  \}/,
  `if (playerCount === 2) {
     if (isTransitioning) return;
     // If timer runs out, evaluate whoever guessed!
     evaluateClosestWins(target);
  }`
);

// Reset isTransitioning on new rounds
js = js.replace(
  /currentZoom = 0;/,
  `currentZoom = 0;
  isTransitioning = false;`
);


// 6. Fix Single-Player Wild Guess Penalty
js = js.replace(
  /if \(playerCount === 2 && dist > 4\.0\) \{/,
  `if (dist > 4.0) {`
);

// 7. Update Steal Phase zooming to use viewBox
js = js.replace(
  /function resetMapView\(\) \{[\s\S]*?\}/,
  `function resetMapView() {
  if (mapSvg) {
    mapSvg.setAttribute('viewBox', \`0 0 \${MAP_WIDTH} \${MAP_HEIGHT}\`);
  }
}`
);

// Single Player zoom logic replace
js = js.replace(
  /const center = zoomMapToBounds\(p1Guess\.x, p1Guess\.y, targetPt\.x, targetPt\.y\);\n        p1Pos\.x = center\.x; p1Pos\.y = center\.y; \/\/ Teleport/,
  `const zoomData = calculateZoomViewBox(p1Guess.x, p1Guess.y, targetPt.x, targetPt.y, currentZoom);
        mapSvg.setAttribute('viewBox', \`\${zoomData.x} \${zoomData.y} \${zoomData.width} \${zoomData.height}\`);
        p1Pos.x = zoomData.center.x; p1Pos.y = zoomData.center.y;`
);

// Multiplayer Steal logic replace
js = js.replace(
  /const center = zoomMapToBounds\(pos\.x, pos\.y, targetPt\.x, targetPt\.y\);\n                currentZoom\+\+;/,
  `const zoomData = calculateZoomViewBox(pos.x, pos.y, targetPt.x, targetPt.y, currentZoom);
                mapSvg.setAttribute('viewBox', \`\${zoomData.x} \${zoomData.y} \${zoomData.width} \${zoomData.height}\`);
                currentZoom++;`
);

js = js.replace(
  /p1Pos\.x = center\.x; p1Pos\.y = center\.y;\n                p2Pos\.x = center\.x; p2Pos\.y = center\.y;/,
  `p1Pos.x = zoomData.center.x; p1Pos.y = zoomData.center.y;
                p2Pos.x = zoomData.center.x; p2Pos.y = zoomData.center.y;`
);

// Add isTransitioning wrapper around BOTH setTimeouts
js = js.replace(
  /setTimeout\(\(\) => \{[\s\S]*?const targetPt = latLonToXY\(target\.lat, target\.lon\);/g,
  `isTransitioning = true;
             setTimeout(() => {
                isTransitioning = false;
                const targetPt = latLonToXY(target.lat, target.lon);`
);

fs.writeFileSync('frontend/js/geogame.js', js);
console.log('Successfully refactored geogame.js');
