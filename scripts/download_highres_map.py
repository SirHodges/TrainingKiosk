import math
import urllib.request
from PIL import Image
import os

lat_center = 45.385
lon_center = -75.700
zoom = 13

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

tiles = []
for y in range(cy-3, cy+3):
    for x in range(cx-4, cx+4):
        tiles.append((x, y))

# Voyager has labels and street names
url_template = "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
out_dir = "tiles_highres"
os.makedirs(out_dir, exist_ok=True)

img = Image.new('RGB', (8 * 256, 6 * 256))

for idx, (x, y) in enumerate(tiles):
    url = url_template.format(z=zoom, x=x, y=y)
    path = f"{out_dir}/{x}_{y}.png"
    print(f"Downloading {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
        out_file.write(response.read())
    
    tile_img = Image.open(path)
    px = (x - (cx-4)) * 256
    py = (y - (cy-3)) * 256
    img.paste(tile_img, (px, py))

top_lat, left_lon = num2deg(cx-4, cy-3, zoom)
bottom_lat, right_lon = num2deg(cx+4, cy+3, zoom)

print(f"Image Size: {img.width}x{img.height}")
print(f"Bounds:")
print(f"minLon: {left_lon}")
print(f"maxLon: {right_lon}")
print(f"minLat: {bottom_lat}")
print(f"maxLat: {top_lat}")

img.save("frontend/assets/ottawa_map_high_res.png")
print("Saved to frontend/assets/ottawa_map_high_res.png")
