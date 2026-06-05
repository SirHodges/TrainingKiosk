const fs = require('fs');

let js = fs.readFileSync('frontend/js/geogame.js', 'utf8');

// Remove the `const MAP_WIDTH = ...;` and `const MAP_HEIGHT = ...;`
js = js.replace(/const MAP_WIDTH = 1024;\n/, '');
js = js.replace(/const MAP_HEIGHT = 1024;\n/, ''); // In case it was 1024
js = js.replace(/const MAP_WIDTH = 1200;\n/, '');
js = js.replace(/const MAP_HEIGHT = 800;\n/, '');

// Also remove MAP_BOUNDS if it was declared without export
js = js.replace(/const MAP_BOUNDS = \{[\s\S]*?maxLon: -75\.3 \};\n/, '');

// Also zoomMapTo seems to still be left in the code. Let's make sure it's removed.
js = js.replace(/function zoomMapTo\(x, y, scale\) \{[\s\S]*?\}\n/, '');

fs.writeFileSync('frontend/js/geogame.js', js);
console.log('Cleaned up geogame.js constants');
