import math
import urllib.request
from PIL import Image
import os

# Ottawa Center
lat_center = 45.385
lon_center = -75.700
zoom = 12

def deg2num(lat_deg, lon_deg, zoom):
  lat_rad = math.radians(lat_deg)
  n = 2.0 ** zoom
  xtile = int((lon_deg + 180.0) / 360.0 * n)
  ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
  return (xtile, ytile)

def num2deg(xtile, ytile, zoom):
  n = 2.0 ** zoom
  lon_deg = xtile / n * 360.0 - 180.0
  lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
  lat_deg = math.degrees(lat_rad)
  return (lat_deg, lon_deg)

cx, cy = deg2num(lat_center, lon_center, zoom)

# Let's download a 4x3 grid of tiles around the center
# x: cx-2 to cx+1 (4 tiles wide) -> 4 * 256 = 1024px
# y: cy-1 to cy+1 (3 tiles high) -> 3 * 256 = 768px
tiles = []
for y in range(cy-1, cy+2):
    for x in range(cx-2, cx+2):
        tiles.append((x, y))

# Download tiles (Carto Dark matter for dark theme)
url_template = "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"

out_dir = "tiles"
os.makedirs(out_dir, exist_ok=True)

img = Image.new('RGB', (4 * 256, 3 * 256))

for idx, (x, y) in enumerate(tiles):
    url = url_template.format(z=zoom, x=x, y=y)
    path = f"{out_dir}/{x}_{y}.png"
    print(f"Downloading {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
        out_file.write(response.read())
    
    # Paste into main image
    tile_img = Image.open(path)
    px = (x - (cx-2)) * 256
    py = (y - (cy-1)) * 256
    img.paste(tile_img, (px, py))

# Calculate exact bounds of this new image
top_lat, left_lon = num2deg(cx-2, cy-1, zoom)
bottom_lat, right_lon = num2deg(cx+2, cy+2, zoom)

print(f"Image Size: {img.width}x{img.height}")
print(f"Bounds:")
print(f"minLon: {left_lon}")
print(f"maxLon: {right_lon}")
print(f"minLat: {bottom_lat}")
print(f"maxLat: {top_lat}")

img.save("frontend/assets/ottawa_map_carto.png")
print("Saved to frontend/assets/ottawa_map_carto.png")
