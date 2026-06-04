const fs = require('fs');
const file = 'frontend/js/geogame.js';
let content = fs.readFileSync(file, 'utf8');

// Remove clearPins() from single player zoom logic
content = content.replace(
  /        p1HasGuessed = false; \/\/ reset\n        clearPins\(\);/g,
  `        p1HasGuessed = false; // reset`
);

fs.writeFileSync(file, content);
console.log('Fixed single player ghost pins.');
