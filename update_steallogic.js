const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove 🔒 from createLockIcon (now createFeedbackIcon)
content = content.replace(
  /function createLockIcon\(color\) \{[\s\S]*?return group;\n\}/,
  `function createLockIcon(color) {
  const svgNS = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(svgNS, "g");
  group.style.display = 'none';
  
  const textLabel = document.createElementNS(svgNS, "text");
  textLabel.setAttribute("font-size", "14");
  textLabel.setAttribute("font-weight", "bold");
  textLabel.setAttribute("text-anchor", "middle");
  textLabel.setAttribute("dominant-baseline", "central");
  textLabel.setAttribute("fill", color || "white");
  textLabel.setAttribute("y", "0");
  textLabel.textContent = "Wild Guess!";
  textLabel.style.textShadow = "1px 1px 2px black, -1px -1px 2px black";
  
  group.appendChild(textLabel);
  return group;
}`
);

// 2. Add p1LockMessage, p2LockMessage to declarations
content = content.replace(
  'let p1LockIcon, p2LockIcon;',
  'let p1LockIcon, p2LockIcon;\nlet p1LockMessage = "Wild Guess!";\nlet p2LockMessage = "Wild Guess!";'
);

// 3. pollGamepadsForReticles rendering logic
content = content.replace(
  /\/\/ Render Reticles[\s\S]*?animationFrameId = requestAnimationFrame\(pollGamepadsForReticles\);/,
  `// Render Reticles
  const renderFeedback = (pos, lockedUntil, lockMsg, feedbackIcon, reticle, hasGuessed, eliminated) => {
     if (eliminated || hasGuessed) {
        if (reticle) reticle.style.display = 'none';
        if (feedbackIcon) feedbackIcon.style.display = 'none';
        return;
     }
     
     if (now < lockedUntil) {
        if (reticle) reticle.style.display = 'none';
        if (feedbackIcon) {
           feedbackIcon.style.display = 'inline';
           feedbackIcon.setAttribute('transform', \`translate(\${pos.x}, \${pos.y})\`);
           
           const txt = feedbackIcon.querySelector('text');
           if (lockMsg === "COUNTDOWN") {
              const secsLeft = Math.ceil((lockedUntil - now) / 1000);
              txt.textContent = secsLeft.toString();
              txt.setAttribute('font-size', '36');
           } else {
              txt.textContent = lockMsg;
              txt.setAttribute('font-size', '14');
           }
        }
     } else {
        if (reticle) {
           reticle.style.display = 'inline';
           reticle.setAttribute('transform', \`translate(\${pos.x}, \${pos.y})\`);
        }
        if (feedbackIcon) feedbackIcon.style.display = 'none';
     }
  };

  renderFeedback(p1Pos, p1LockedUntil, p1LockMessage, p1LockIcon, p1Reticle, p1HasGuessed, p1Eliminated);
  if (playerCount === 2) {
     renderFeedback(p2Pos, p2LockedUntil, p2LockMessage, p2LockIcon, p2Reticle, p2HasGuessed, p2Eliminated);
  }
  
  animationFrameId = requestAnimationFrame(pollGamepadsForReticles);`
);

// Fix axes processing missing !p1HasGuessed
content = content.replace(
  /if \(\!p1Eliminated && now >= p1LockedUntil\) processAxes\(p1Axes, p1Pos\);/,
  `if (!p1Eliminated && !p1HasGuessed && now >= p1LockedUntil) processAxes(p1Axes, p1Pos);`
);
content = content.replace(
  /if \(playerCount === 2 && \!p2Eliminated && now >= p2LockedUntil\) processAxes\(p2Axes, p2Pos\);/,
  `if (playerCount === 2 && !p2Eliminated && !p2HasGuessed && now >= p2LockedUntil) processAxes(p2Axes, p2Pos);`
);

// 4. Update handleGamepadButton 4km lockout
content = content.replace(
  /if \(playerCount === 2 && dist > 4\.0\) \{[\s\S]*?return;\n    \}/,
  `if (playerCount === 2 && dist > 4.0) {
      if (isP1) { p1LockedUntil = now + 2000; p1LockMessage = "Wild guess"; }
      else { p2LockedUntil = now + 2000; p2LockMessage = "Wild guess"; }
      return;
    }`
);

// 5. Update Steal Phase Logic
content = content.replace(
  /if \(isP1\) p1Eliminated = true; else p2Eliminated = true;\n             drawGuessMarker\(pos\.x, pos\.y, isP1 \? "#3b82f6" : "#ef4444"\);\n             \n             setTimeout\(\(\) => \{[\s\S]*?pollGamepadsForReticles\(\);\n             \}, 2000\);/,
  `// Don't eliminate yet! Give them a countdown lock!
             if (isP1) p1Eliminated = false; else p2Eliminated = false;
             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
             
             setTimeout(() => {
                const targetPt = latLonToXY(target.lat, target.lon);
                const center = zoomMapToBounds(pos.x, pos.y, targetPt.x, targetPt.y);
                currentZoom = 1;
                currentState = 'GUESSING';
                clearPins();
                drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");
                
                // Teleport BOTH players into the zoomed area!
                p1Pos.x = center.x; p1Pos.y = center.y;
                p2Pos.x = center.x; p2Pos.y = center.y;
                
                // Set the penalty lock for the person who guessed
                const lockTime = Date.now() + 3000;
                if (isP1) { p1LockedUntil = lockTime; p1LockMessage = "COUNTDOWN"; }
                else { p2LockedUntil = lockTime; p2LockMessage = "COUNTDOWN"; }
                
                // Also reset their "guessed" status so they can guess again
                if (isP1) { p1HasGuessed = false; p1Guess = null; }
                else { p2HasGuessed = false; p2Guess = null; }
                
                document.getElementById('geogame-status-text').textContent = \`STEAL ROUND! Player \${isP1 ? 2 : 1} gets a head start!\`;
                startTimer(15);
                pollGamepadsForReticles();
             }, 2000);`
);

fs.writeFileSync(file, content);
console.log('Successfully updated steal logic.');
