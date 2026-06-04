const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add lock variables
content = content.replace(
  'let p1Guess = null;\nlet p2Guess = null;',
  'let p1Guess = null;\nlet p2Guess = null;\nlet p1LockedUntil = 0;\nlet p2LockedUntil = 0;\nlet p1Eliminated = false;\nlet p2Eliminated = false;\nlet p1LockIcon, p2LockIcon;'
);

// 2. Update setupReticles
content = content.replace(
  /function setupReticles\(\) \{[\s\S]*?function createReticle\(color\) \{/,
  `function setupReticles() {
  if (p1Reticle) p1Reticle.remove();
  if (p2Reticle) p2Reticle.remove();
  if (p1LockIcon) p1LockIcon.remove();
  if (p2LockIcon) p2LockIcon.remove();
  
  if (inputMode === 'gamepad') {
    p1Reticle = createReticle("#3b82f6");
    p1LockIcon = createLockIcon("#3b82f6");
    mapSvg.appendChild(p1Reticle);
    mapSvg.appendChild(p1LockIcon);
    if (playerCount === 2) {
      p2Reticle = createReticle("#ef4444");
      p2LockIcon = createLockIcon("#ef4444");
      mapSvg.appendChild(p2Reticle);
      mapSvg.appendChild(p2LockIcon);
    }
  }
}

function createLockIcon(color) {
  const svgNS = "http://www.w3.org/2000/svg";
  const text = document.createElementNS(svgNS, "text");
  text.setAttribute("font-size", "28");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.textContent = "🔒";
  text.style.display = 'none';
  return text;
}

function createReticle(color) {`
);

// 3. Reset in startRound
content = content.replace(
  'p1HasGuessed = false;\n  p2HasGuessed = false;\n  p1Guess = null;\n  p2Guess = null;',
  'p1HasGuessed = false;\n  p2HasGuessed = false;\n  p1Guess = null;\n  p2Guess = null;\n  p1LockedUntil = 0; p2LockedUntil = 0;\n  p1Eliminated = false; p2Eliminated = false;\n  if(p1LockIcon) p1LockIcon.style.display = "none";\n  if(p2LockIcon) p2LockIcon.style.display = "none";'
);

// 4. pollGamepadsForReticles
content = content.replace(
  /function pollGamepadsForReticles\(\) \{[\s\S]*?animationFrameId = requestAnimationFrame\(pollGamepadsForReticles\);\n\}/,
  `function pollGamepadsForReticles() {
  if (currentState !== 'GUESSING') return;
  
  const speed = currentZoom === 0 ? 3 : 1; // Pixels per frame (slower for zoom)
  
  const processAxes = (axes, posObj) => {
    if (Math.abs(axes.x) > 0.1) posObj.x += axes.x * speed;
    if (Math.abs(axes.y) > 0.1) posObj.y += axes.y * speed;
    
    // Bounds check
    posObj.x = Math.max(0, Math.min(MAP_WIDTH, posObj.x));
    posObj.y = Math.max(0, Math.min(MAP_HEIGHT, posObj.y));
  };
  
  const now = Date.now();
  if (!p1Eliminated && now >= p1LockedUntil) processAxes(p1Axes, p1Pos);
  if (playerCount === 2 && !p2Eliminated && now >= p2LockedUntil) processAxes(p2Axes, p2Pos);
  
  // Also poll HTML5 Gamepads as fallback for local axes
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  if (gps[0] && gps[0].axes.length >= 2) {
      if (Math.abs(gps[0].axes[0]) > 0.1 || Math.abs(gps[0].axes[1]) > 0.1) {
         p1Axes.x = gps[0].axes[0];
         p1Axes.y = gps[0].axes[1];
      }
  }
  if (gps[1] && gps[1].axes.length >= 2) {
      if (Math.abs(gps[1].axes[0]) > 0.1 || Math.abs(gps[1].axes[1]) > 0.1) {
         p2Axes.x = gps[1].axes[0];
         p2Axes.y = gps[1].axes[1];
      }
  }

  // Render Reticles
  if (p1Reticle && !p1Eliminated) {
    if (now < p1LockedUntil) {
       p1Reticle.style.display = 'none';
       if (p1LockIcon) {
          p1LockIcon.style.display = 'inline';
          p1LockIcon.setAttribute('x', p1Pos.x);
          p1LockIcon.setAttribute('y', p1Pos.y);
       }
    } else {
       p1Reticle.style.display = 'inline';
       if (p1LockIcon) p1LockIcon.style.display = 'none';
       p1Reticle.setAttribute('transform', \`translate(\${p1Pos.x}, \${p1Pos.y})\`);
    }
  } else if (p1Eliminated) {
    if (p1Reticle) p1Reticle.style.display = 'none';
    if (p1LockIcon) p1LockIcon.style.display = 'none';
  }
  
  if (p2Reticle && playerCount === 2 && !p2Eliminated) {
    if (now < p2LockedUntil) {
       p2Reticle.style.display = 'none';
       if (p2LockIcon) {
          p2LockIcon.style.display = 'inline';
          p2LockIcon.setAttribute('x', p2Pos.x);
          p2LockIcon.setAttribute('y', p2Pos.y);
       }
    } else {
       p2Reticle.style.display = 'inline';
       if (p2LockIcon) p2LockIcon.style.display = 'none';
       p2Reticle.setAttribute('transform', \`translate(\${p2Pos.x}, \${p2Pos.y})\`);
    }
  } else if (p2Eliminated) {
    if (p2Reticle) p2Reticle.style.display = 'none';
    if (p2LockIcon) p2LockIcon.style.display = 'none';
  }
  
  animationFrameId = requestAnimationFrame(pollGamepadsForReticles);
}`
);

// 5. handleGamepadButton
content = content.replace(
  /function handleGamepadButton\(e\) \{[\s\S]*?\}\n\}\n\n\/\/ =====/,
  `function handleGamepadButton(e) {
  if (currentState === 'INTRO' && inputMode === 'gamepad') {
    beginStartFlow();
    return;
  }
  
  if (currentState !== 'GUESSING' || inputMode !== 'gamepad') return;
  const { button, player } = e.detail;
  
  if (['A', 'B', 'X', 'Y'].includes(button)) {
    const isP1 = (player === 0);
    const now = Date.now();
    
    if (isP1 && (p1Eliminated || now < p1LockedUntil)) return;
    if (!isP1 && (p2Eliminated || now < p2LockedUntil || playerCount === 1)) return;
    
    const pos = isP1 ? p1Pos : p2Pos;
    const target = currentLocations[currentRoundIndex];
    const latLon = xyToLatLon(pos.x, pos.y);
    const dist = calculateDistance(latLon.lat, latLon.lon, target.lat, target.lon);
    
    if (playerCount === 2 && dist > 4.0) {
      if (isP1) p1LockedUntil = now + 2000;
      else p2LockedUntil = now + 2000;
      return;
    }
    
    if (isP1) { p1HasGuessed = true; p1Guess = { ...p1Pos }; }
    else { p2HasGuessed = true; p2Guess = { ...p2Pos }; }
    
    if (playerCount === 1) {
       clearInterval(timerInterval);
       evaluateGuesses();
    } else {
       // Multiplayer Sudden Death
       if (dist <= 0.1) {
          clearInterval(timerInterval);
          const pts = currentZoom === 0 ? 100 : 50;
          document.getElementById('geogame-status-text').textContent = \`🎯 Player \${isP1 ? 1 : 2} Direct Hit! (\${(dist*1000).toFixed(0)}m)\`;
          revealTarget(isP1 ? pts : 0, isP1 ? 0 : pts, \`Player \${isP1 ? 1 : 2}\`);
       } else {
          // Near miss
          if (currentZoom === 0) {
             clearInterval(timerInterval);
             document.getElementById('geogame-status-text').textContent = \`Player \${isP1 ? 1 : 2} Near Miss! Zooming in for STEAL!\`;
             if (isP1) p1Eliminated = true; else p2Eliminated = true;
             
             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
             
             setTimeout(() => {
                zoomMapTo(pos.x, pos.y, 4.0);
                currentZoom = 1;
                currentState = 'GUESSING';
                clearPins();
                drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
                
                document.getElementById('geogame-status-text').textContent = \`STEAL ROUND! Player \${isP1 ? 2 : 1}, find it!\`;
                startTimer(10);
                pollGamepadsForReticles();
             }, 1500);
          } else {
             // Missed Steal
             if (isP1) p1Eliminated = true; else p2Eliminated = true;
             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
             
             if (p1Eliminated && p2Eliminated) {
                clearInterval(timerInterval);
                document.getElementById('geogame-status-text').textContent = \`❌ Both missed!\`;
                revealTarget(0, 0, 'Nobody');
             }
          }
       }
    }
  }
}

// =====`
);

// 6. evaluateGuesses for Multiplayer TimeOut
content = content.replace(
  /\/\/ Multiplayer Steal Logic[\s\S]*?\} \n    \/\/ Complete miss[\s\S]*?\}\n  \}\n\}/,
  `// Multiplayer Timeout Logic
  if (playerCount === 2) {
    document.getElementById('geogame-status-text').textContent = \`❌ Time's up! Nobody wins.\`;
    revealTarget(0, 0, 'Nobody');
  }
}`
);

fs.writeFileSync(file, content);
console.log('Successfully updated geogame.js');
