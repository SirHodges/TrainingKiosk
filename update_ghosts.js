const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

// Update drawGuessMarker to add the 'game-pin' class and return the element
content = content.replace(
  /function drawGuessMarker\(x, y, color = "#ef4444"\) \{[\s\S]*?mapSvg\.appendChild\(group\);\n\}/,
  `function drawGuessMarker(x, y, color = "#ef4444") {
  if (!mapSvg) return null;
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
  return group;
}`
);

// We need to fix the logic in Steal Phase
// Find the block:
// drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444"); // Bright initial pin
// ... setTimeout ...
// currentZoom++;
// currentState = 'GUESSING';
// // Do NOT clearPins! Make the old pin darker
// drawGuessMarker(pos.x, pos.y, isP1 ? "#1e3a8a" : "#7f1d1d");

content = content.replace(
  /             drawGuessMarker\(pos\.x, pos\.y, isP1 \? "#3b82f6" : "#ef4444"\); \/\/ Bright initial pin[\s\S]*?drawGuessMarker\(pos\.x, pos\.y, isP1 \? "#1e3a8a" : "#7f1d1d"\);/,
  `             const tempPin = drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444"); // Bright initial pin
             
             setTimeout(() => {
                const targetPt = latLonToXY(target.lat, target.lon);
                const center = zoomMapToBounds(pos.x, pos.y, targetPt.x, targetPt.y);
                currentZoom++;
                currentState = 'GUESSING';
                
                // Instead of clearPins, remove the bright temp pin, and add a persistent dark one
                if (tempPin && tempPin.parentNode) tempPin.parentNode.removeChild(tempPin);
                const ghostPin = drawGuessMarker(pos.x, pos.y, isP1 ? "#1e3a8a" : "#7f1d1d");
                if (ghostPin) ghostPin.style.opacity = '0.5';`
);

// We also need to fix single player.
content = content.replace(
  /if \(p1Dist < 4\.0 && currentZoom === 0\) \{/,
  `if (p1Dist < 4.0 && currentZoom < 2) {`
);

// In single player, it clears pins and draws again.
content = content.replace(
  /const pts = calculatePoints\(p1Dist\);\n      setTimeout\(\(\) => \{[\s\S]*?p1Pos\.x = center\.x; p1Pos\.y = center\.y; \/\/ Teleport\n        currentZoom = 1;/,
  `const pts = calculatePoints(p1Dist);
      const tempPin = drawGuessMarker(p1Guess.x, p1Guess.y, "#3b82f6");
      setTimeout(() => {
        const targetPt = latLonToXY(target.lat, target.lon);
        const center = zoomMapToBounds(p1Guess.x, p1Guess.y, targetPt.x, targetPt.y);
        p1Pos.x = center.x; p1Pos.y = center.y; // Teleport
        
        if (tempPin && tempPin.parentNode) tempPin.parentNode.removeChild(tempPin);
        const ghostPin = drawGuessMarker(p1Guess.x, p1Guess.y, "#1e3a8a");
        if (ghostPin) ghostPin.style.opacity = '0.5';
        
        currentZoom++;`
);

// Fix scale limits in zoomMapToBounds
content = content.replace(
  /const scale = Math\.min\(MAP_WIDTH \/ w, MAP_HEIGHT \/ h, 6\.0\);/,
  `const scale = Math.min(MAP_WIDTH / w, MAP_HEIGHT / h, 20.0);`
);

fs.writeFileSync(file, content);
console.log('Fixed Ghost pins and single player zoom mechanics.');
