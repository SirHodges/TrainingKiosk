const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Math scoring function
const mathFunc = `
function calculatePoints(distKm) {
  if (distKm > 4.0) return 0;
  const distM = distKm * 1000;
  if (distM <= 50) return 100;
  const raw = 5000 / distM;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
`;
if (!content.includes('function calculatePoints')) {
  content = content.replace('function calculateDistance', mathFunc + '\nfunction calculateDistance');
}

// 2. Lock Icon Fix
content = content.replace(
  /function createLockIcon\(color\) \{[\s\S]*?return text;\n\}/,
  `function createLockIcon(color) {
  const svgNS = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(svgNS, "g");
  group.style.display = 'none';
  
  const textIcon = document.createElementNS(svgNS, "text");
  textIcon.setAttribute("font-size", "28");
  textIcon.setAttribute("text-anchor", "middle");
  textIcon.setAttribute("y", "0");
  textIcon.textContent = "🔒";
  
  const textLabel = document.createElementNS(svgNS, "text");
  textLabel.setAttribute("font-size", "12");
  textLabel.setAttribute("font-weight", "bold");
  textLabel.setAttribute("text-anchor", "middle");
  textLabel.setAttribute("fill", color || "white");
  textLabel.setAttribute("y", "20");
  textLabel.textContent = "Wild Guess!";
  textLabel.style.textShadow = "1px 1px 2px black, -1px -1px 2px black";
  
  group.appendChild(textIcon);
  group.appendChild(textLabel);
  return group;
}`
);

// 3. Update icon setting in pollGamepadsForReticles
content = content.replace(
  /p1LockIcon\.setAttribute\('x', p1Pos\.x\);\n          p1LockIcon\.setAttribute\('y', p1Pos\.y\);/g,
  `p1LockIcon.setAttribute('transform', \`translate(\${p1Pos.x}, \${p1Pos.y})\`);`
);
content = content.replace(
  /p2LockIcon\.setAttribute\('x', p2Pos\.x\);\n          p2LockIcon\.setAttribute\('y', p2Pos\.y\);/g,
  `p2LockIcon.setAttribute('transform', \`translate(\${p2Pos.x}, \${p2Pos.y})\`);`
);

// 4. Bounding Box Zoom & Teleport
const zoomFunc = `
function zoomMapToBounds(x1, y1, x2, y2) {
  const padding = 100;
  let minX = Math.min(x1, x2) - padding;
  let maxX = Math.max(x1, x2) + padding;
  let minY = Math.min(y1, y2) - padding;
  let maxY = Math.max(y1, y2) + padding;
  
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = Math.min(MAP_WIDTH / w, MAP_HEIGHT / h, 6.0);
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  zoomMapTo(centerX, centerY, scale);
  
  return { x: centerX, y: centerY };
}
`;
if (!content.includes('function zoomMapToBounds')) {
  content = content.replace('function zoomMapTo(x, y, scale)', zoomFunc + '\nfunction zoomMapTo(x, y, scale)');
}

// 5. handleGamepadButton Multiplayer Logic Fix
const newMultiLogic = `
    if (playerCount === 1) {
       clearInterval(timerInterval);
       evaluateGuesses();
    } else {
       // --- MULTIPLAYER MATH SCORING & ZOOM ---
       if (dist <= 0.05) { // 50m direct hit
          clearInterval(timerInterval);
          const pts = calculatePoints(dist);
          document.getElementById('geogame-status-text').textContent = \`🎯 Player \${isP1 ? 1 : 2} Direct Hit! (\${(dist*1000).toFixed(0)}m)\`;
          revealTarget(isP1 ? pts : 0, isP1 ? 0 : pts, \`Player \${isP1 ? 1 : 2}\`);
       } else {
          if (currentZoom === 0) {
             // Near Miss -> Zoom and let the other player steal!
             clearInterval(timerInterval);
             document.getElementById('geogame-status-text').textContent = \`Player \${isP1 ? 1 : 2} is \${(dist*1000).toFixed(0)}m away. Zooming in for STEAL!\`;
             if (isP1) p1Eliminated = true; else p2Eliminated = true;
             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
             
             setTimeout(() => {
                const targetPt = latLonToXY(target.lat, target.lon);
                const center = zoomMapToBounds(pos.x, pos.y, targetPt.x, targetPt.y);
                currentZoom = 1;
                currentState = 'GUESSING';
                clearPins();
                drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
                
                // Teleport the active player's reticle into the zoomed area!
                if (isP1) { p2Pos.x = center.x; p2Pos.y = center.y; }
                else { p1Pos.x = center.x; p1Pos.y = center.y; }
                
                document.getElementById('geogame-status-text').textContent = \`STEAL ROUND! Player \${isP1 ? 2 : 1}, find it!\`;
                startTimer(15); // Give them 15s to steal
                pollGamepadsForReticles();
             }, 2000);
          } else {
             // Missed Steal Round!
             if (isP1) p1Eliminated = true; else p2Eliminated = true;
             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
             
             if (p1Eliminated && p2Eliminated) {
                clearInterval(timerInterval);
                // End of round: both guessed. Closest wins!
                evaluateClosestWins(target);
             }
          }
       }
    }
  }
}

function evaluateClosestWins(target) {
  let p1Dist = 999, p2Dist = 999;
  if (p1Guess) p1Dist = calculateDistance(xyToLatLon(p1Guess.x, p1Guess.y).lat, xyToLatLon(p1Guess.x, p1Guess.y).lon, target.lat, target.lon);
  if (p2Guess) p2Dist = calculateDistance(xyToLatLon(p2Guess.x, p2Guess.y).lat, xyToLatLon(p2Guess.x, p2Guess.y).lon, target.lat, target.lon);
  
  const p1Pts = calculatePoints(p1Dist);
  const p2Pts = calculatePoints(p2Dist);
  
  if (p1Dist < p2Dist && p1Pts > 0) {
     document.getElementById('geogame-status-text').textContent = \`Player 1 was closer! (\${(p1Dist*1000).toFixed(0)}m)\`;
     revealTarget(p1Pts, 0, 'Player 1');
  } else if (p2Dist < p1Dist && p2Pts > 0) {
     document.getElementById('geogame-status-text').textContent = \`Player 2 was closer! (\${(p2Dist*1000).toFixed(0)}m)\`;
     revealTarget(0, p2Pts, 'Player 2');
  } else if (p1Pts > 0 && p1Pts === p2Pts) {
     document.getElementById('geogame-status-text').textContent = \`Tie! Both get \${p1Pts} pts!\`;
     revealTarget(p1Pts, p2Pts, 'Tie');
  } else {
     document.getElementById('geogame-status-text').textContent = \`❌ Both missed completely!\`;
     revealTarget(0, 0, 'Nobody');
  }
}
// =====
`;
content = content.replace(
  /if \(playerCount === 1\) \{[\s\S]*?\}\n\}\n\n\/\/ =====/,
  newMultiLogic
);

// 6. Multiplayer Timeout Logic
content = content.replace(
  /\/\/ Multiplayer Timeout Logic[\s\S]*?\}\n\}/,
  `// Multiplayer Timeout Logic
  if (playerCount === 2) {
     // If timer runs out, evaluate whoever guessed!
     evaluateClosestWins(target);
  }
}`
);

fs.writeFileSync(file, content);
console.log('Successfully updated geogame.js');
