const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Ghost Markers Update: 
// Modify drawGuessMarker to add an 'old-pin' class if we want, or just a darker color.
// Wait, we can just change the color parameter directly!
// But we must NOT call `clearPins()` when we zoom! 
// Let's replace the `clearPins()` inside the Steal logic.
content = content.replace(
  /clearPins\(\);\n                drawGuessMarker\(pos\.x, pos\.y, isP1 \? "#3b82f6" : "#ef4444"\);/g,
  `// Do NOT clearPins! Make the old pin darker
                drawGuessMarker(pos.x, pos.y, isP1 ? "#1e3a8a" : "#7f1d1d");` // Dark blue and Dark red
);

// 2. Fix the Steal Phase logic from `currentZoom === 0` to `currentZoom < 2`
content = content.replace(
  /if \(currentZoom === 0\) \{/g,
  `if (currentZoom < 2) {`
);

// We must also fix the `drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444");` right BEFORE the setTimeout
// Wait, the one before the setTimeout should draw the bright one, then 2 seconds later it stays, and we don't redraw it?
// Actually, if we don't clearPins, the bright one will still be there. 
// So before setTimeout we draw bright. Inside setTimeout, we can just leave it! 
// Let's adjust that properly.
content = content.replace(
  /             drawGuessMarker\(pos\.x, pos\.y, isP1 \? "#3b82f6" : "#ef4444"\);\n             \n             setTimeout\(\(\) => \{[\s\S]*?currentZoom = 1;/,
  `             drawGuessMarker(pos.x, pos.y, isP1 ? "#3b82f6" : "#ef4444"); // Bright initial pin
             
             setTimeout(() => {
                const targetPt = latLonToXY(target.lat, target.lon);
                const center = zoomMapToBounds(pos.x, pos.y, targetPt.x, targetPt.y);
                currentZoom++;`
);

// 3. Implement Circular Wipe in createFeedbackIcon
// We will replace `createFeedbackIcon` to include an SVG `<path>` for the circle
const newFeedbackIcon = `function createFeedbackIcon(color) {
  const svgNS = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(svgNS, "g");
  group.style.display = 'none';
  
  // Background circle (dark translucent)
  const bg = document.createElementNS(svgNS, "circle");
  bg.setAttribute("r", "20");
  bg.setAttribute("fill", "rgba(0,0,0,0.6)");
  group.appendChild(bg);
  
  // The wipe path (pie slice)
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("fill", color || "white");
  path.classList.add('wipe-path'); // to query it later
  group.appendChild(path);
  
  const textLabel = document.createElementNS(svgNS, "text");
  textLabel.setAttribute("font-size", "14");
  textLabel.setAttribute("font-weight", "bold");
  textLabel.setAttribute("text-anchor", "middle");
  textLabel.setAttribute("dominant-baseline", "central");
  textLabel.setAttribute("fill", "white");
  textLabel.setAttribute("y", "0");
  textLabel.textContent = "Wild Guess!";
  textLabel.style.textShadow = "1px 1px 2px black, -1px -1px 2px black";
  
  group.appendChild(textLabel);
  return group;
}`;

content = content.replace(
  /function createFeedbackIcon\(color\) \{[\s\S]*?return group;\n\}/,
  newFeedbackIcon
);

// Since I renamed createLockIcon to createFeedbackIcon in the last edit... wait, DID I rename it? 
// Let me verify if it was renamed. If not, I should replace createLockIcon!
content = content.replace(
  /function createLockIcon\(color\) \{[\s\S]*?return group;\n\}/,
  newFeedbackIcon.replace('createFeedbackIcon', 'createLockIcon') // Fallback just in case
);

// 4. Update the renderFeedback function to calculate and draw the SVG arc
const newRenderFeedback = `// Helper to calculate SVG pie slice path
  const describeArc = (x, y, radius, startAngle, endAngle) => {
      const polarToCartesian = (cx, cy, r, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return { x: cx + (r * Math.cos(angleInRadians)), y: cy + (r * Math.sin(angleInRadians)) };
      };
      
      const start = polarToCartesian(x, y, radius, endAngle);
      const end = polarToCartesian(x, y, radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return [
          "M", x, y,
          "L", start.x, start.y,
          "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
          "Z"
      ].join(" ");
  };

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
           const path = feedbackIcon.querySelector('path');
           const bg = feedbackIcon.querySelector('circle');
           
           if (lockMsg === "COUNTDOWN") {
              if (bg) bg.style.display = 'inline';
              if (path) path.style.display = 'inline';
              const remainingMs = lockedUntil - now;
              const secsLeft = Math.ceil(remainingMs / 1000);
              txt.textContent = secsLeft.toString();
              txt.setAttribute('font-size', '20');
              
              // Draw the circular wipe
              const progress = Math.max(0, Math.min(1, remainingMs / 3000));
              const angle = progress * 360;
              if (path) path.setAttribute('d', describeArc(0, 0, 20, 0, angle));
           } else {
              if (bg) bg.style.display = 'none';
              if (path) path.style.display = 'none';
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
  };`;

content = content.replace(
  /const renderFeedback = \(pos, lockedUntil, lockMsg, feedbackIcon, reticle, hasGuessed, eliminated\) => \{[\s\S]*?if \(feedbackIcon\) feedbackIcon\.style\.display = 'none';\n     \}\n  \};/,
  newRenderFeedback
);

fs.writeFileSync(file, content);
console.log('Successfully updated zoom loops and wipe timer.');
