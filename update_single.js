const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /if \(p1Dist <= 0\.1\) \{[\s\S]*?\} else if \(p1Dist < 2\.0 && currentZoom === 0\) \{/,
  `if (p1Dist <= 0.05) {
      const pts = calculatePoints(p1Dist);
      document.getElementById('geogame-status-text').textContent = \`🎯 Direct Hit! +\${pts} pts (\${(p1Dist * 1000).toFixed(0)}m)\`;
      revealTarget(pts, 0, 'Player 1');
    } else if (p1Dist < 4.0 && currentZoom === 0) {`
);

content = content.replace(
  /const pts = 50;\n      setTimeout\(\(\) => \{[\s\S]*?zoomMapTo\(p1Guess\.x, p1Guess\.y, 4\.0\);/,
  `const pts = calculatePoints(p1Dist);
      setTimeout(() => {
        const targetPt = latLonToXY(target.lat, target.lon);
        const center = zoomMapToBounds(p1Guess.x, p1Guess.y, targetPt.x, targetPt.y);
        p1Pos.x = center.x; p1Pos.y = center.y; // Teleport`
);

fs.writeFileSync(file, content);
console.log("Single player updated.");
