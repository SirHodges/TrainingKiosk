// ==========================================
// GEOGAME MATH & PROJECTION
// ==========================================

export const MAP_BOUNDS = {
  minLat: 45.1,
  maxLat: 45.6,
  minLon: -76.1,
  maxLon: -75.3
};

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 800;

export function latLonToXY(lat, lon) {
  const x = ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * MAP_WIDTH;
  const y = MAP_HEIGHT - (((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * MAP_HEIGHT);
  return { x, y };
}

export function xyToLatLon(x, y) {
  const lon = MAP_BOUNDS.minLon + (x / MAP_WIDTH) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const lat = MAP_BOUNDS.maxLat - (y / MAP_HEIGHT) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return { lat, lon };
}

export function calculatePoints(distKm) {
  if (distKm > 4.0) return 0;
  const distM = distKm * 1000;
  if (distM <= 50) return 100;
  const raw = 5000 / distM;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const latDiff = (lat2 - lat1) * 111;
  const lonDiff = (lon2 - lon1) * 78;
  return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
}

/**
 * Calculates a new viewBox representing a zoomed area that bounds the two given coordinates.
 * Returns { x, y, width, height, center }
 */
export function calculateZoomViewBox(x1, y1, x2, y2, currentZoomLevel) {
  const padding = 100; // pixels
  let minX = Math.min(x1, x2) - padding;
  let maxX = Math.max(x1, x2) + padding;
  let minY = Math.min(y1, y2) - padding;
  let maxY = Math.max(y1, y2) + padding;
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Calculate aspect ratio corrections so the viewBox doesn't distort
  const targetRatio = MAP_WIDTH / MAP_HEIGHT;
  const currentRatio = width / height;
  
  let finalWidth = width;
  let finalHeight = height;
  
  if (currentRatio > targetRatio) {
      // wider than map, so expand height
      finalHeight = width / targetRatio;
  } else {
      // taller than map, so expand width
      finalWidth = height * targetRatio;
  }
  
  // Constrain max zoom scale (cap at roughly 20x zoom = 60px width)
  const minAllowedWidth = MAP_WIDTH / 20.0;
  if (finalWidth < minAllowedWidth) {
      finalWidth = minAllowedWidth;
      finalHeight = minAllowedWidth / targetRatio;
  }
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  let finalX = centerX - finalWidth / 2;
  let finalY = centerY - finalHeight / 2;
  
  // Clamp to map boundaries
  if (finalX < 0) finalX = 0;
  if (finalY < 0) finalY = 0;
  if (finalX + finalWidth > MAP_WIDTH) finalX = MAP_WIDTH - finalWidth;
  if (finalY + finalHeight > MAP_HEIGHT) finalY = MAP_HEIGHT - finalHeight;
  
  return { 
     x: finalX, 
     y: finalY, 
     width: finalWidth, 
     height: finalHeight,
     center: { x: centerX, y: centerY }
  };
}