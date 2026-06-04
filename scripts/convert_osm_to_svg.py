"""
convert_osm_to_svg.py
Converts Overpass API JSON exports into a single stylized SVG map of Ottawa.

Usage: python convert_osm_to_svg.py
Input:  frontend/assets/osm_water.json, frontend/assets/osm_roads.json
Output: frontend/assets/ottawa_map.svg
"""

import json
import sys
from pathlib import Path

# Map configuration
MAP_WIDTH = 1200
MAP_HEIGHT = 800
PADDING = 20

BOUNDS = {
    'min_lon': -75.82,
    'max_lon': -75.58,
    'min_lat': 45.31,
    'max_lat': 45.46
}

# Styling
STYLES = {
    'background': '#0f1923',
    'water_fill': '#1e3a5f',
    'water_stroke': '#2563eb',
    'canal_stroke': '#3b82f6',
    'motorway': '#fbbf24',
    'trunk': '#fb923c',
    'primary': '#94a3b8',
    'grid': '#ffffff',
    'label': '#64748b',
    'neighbourhood': '#94a3b8',
}

# Neighbourhood labels
NEIGHBOURHOODS = [
    ("Kanata", 45.345, -75.80),
    ("Westboro", 45.395, -75.745),
    ("Centretown", 45.415, -75.700),
    ("ByWard Mkt", 45.430, -75.692),
    ("Glebe", 45.400, -75.693),
    ("Alta Vista", 45.390, -75.660),
    ("Vanier", 45.435, -75.660),
    ("Barrhaven", 45.320, -75.76),
    ("Gatineau", 45.450, -75.72),
    ("Sandy Hill", 45.422, -75.680),
    ("LeBreton", 45.416, -75.718),
    ("Dow's Lake", 45.393, -75.705),
    ("Orleans", 45.445, -75.59),
]


def lat_lon_to_xy(lat, lon):
    """Convert lat/lon to SVG x,y coordinates."""
    x = PADDING + ((lon - BOUNDS['min_lon']) / (BOUNDS['max_lon'] - BOUNDS['min_lon'])) * (MAP_WIDTH - 2 * PADDING)
    y = PADDING + ((BOUNDS['max_lat'] - lat) / (BOUNDS['max_lat'] - BOUNDS['min_lat'])) * (MAP_HEIGHT - 2 * PADDING)
    return round(x, 1), round(y, 1)


def parse_osm_json(filepath):
    """Parse Overpass JSON into a dict of nodes and a list of ways."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    nodes = {}
    ways = []
    
    for el in data.get('elements', []):
        if el['type'] == 'node':
            nodes[el['id']] = (el['lat'], el['lon'])
        elif el['type'] == 'way':
            ways.append(el)
    
    return nodes, ways


def way_to_points(way, nodes):
    """Convert a way's node references to a list of (x, y) tuples."""
    points = []
    for nid in way.get('nodes', []):
        if nid in nodes:
            lat, lon = nodes[nid]
            x, y = lat_lon_to_xy(lat, lon)
            points.append((x, y))
    return points


def points_to_polyline(points):
    """Convert a list of (x,y) tuples to an SVG polyline points string."""
    return ' '.join(f'{x},{y}' for x, y in points)


def build_svg():
    """Build the complete SVG string."""
    base_dir = Path(__file__).parent.parent
    water_file = base_dir / 'frontend' / 'assets' / 'osm_water.json'
    roads_file = base_dir / 'frontend' / 'assets' / 'osm_roads.json'
    lakes_file = base_dir / 'frontend' / 'assets' / 'osm_lakes.json'
    
    svg_parts = []
    
    # SVG header
    svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MAP_WIDTH} {MAP_HEIGHT}" '
                     f'width="{MAP_WIDTH}" height="{MAP_HEIGHT}">')
    
    # Background
    svg_parts.append(f'<rect width="{MAP_WIDTH}" height="{MAP_HEIGHT}" fill="{STYLES["background"]}"/>')
    
    # Grid lines
    svg_parts.append('<g opacity="0.06">')
    for lon_step in range(0, 25):
        lon = BOUNDS['min_lon'] + lon_step * 0.01
        if lon > BOUNDS['max_lon']:
            break
        x1, y1 = lat_lon_to_xy(BOUNDS['max_lat'], lon)
        x2, y2 = lat_lon_to_xy(BOUNDS['min_lat'], lon)
        svg_parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{STYLES["grid"]}" stroke-width="0.5"/>')
    for lat_step in range(0, 16):
        lat = BOUNDS['min_lat'] + lat_step * 0.01
        if lat > BOUNDS['max_lat']:
            break
        x1, y1 = lat_lon_to_xy(lat, BOUNDS['min_lon'])
        x2, y2 = lat_lon_to_xy(lat, BOUNDS['max_lon'])
        svg_parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{STYLES["grid"]}" stroke-width="0.5"/>')
    svg_parts.append('</g>')
    
    # ===== WATER AREAS (lakes, river polygons) =====
    if lakes_file.exists():
        nodes, ways = parse_osm_json(lakes_file)
        print(f"Water areas: {len(nodes)} nodes, {len(ways)} ways")
        
        svg_parts.append(f'<g>')
        for way in ways:
            pts = way_to_points(way, nodes)
            if len(pts) < 3:
                continue
            polyline_str = points_to_polyline(pts)
            svg_parts.append(f'<polygon points="{polyline_str}" '
                           f'fill="{STYLES["water_fill"]}" stroke="{STYLES["water_stroke"]}" '
                           f'stroke-width="0.5" opacity="0.6"/>')
        svg_parts.append('</g>')
    
    # ===== WATERWAYS =====
    if water_file.exists():
        nodes, ways = parse_osm_json(water_file)
        print(f"Water: {len(nodes)} nodes, {len(ways)} ways")
        
        # Rivers (thicker, filled look)
        svg_parts.append(f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">')
        for way in ways:
            tags = way.get('tags', {})
            wtype = tags.get('waterway', '')
            pts = way_to_points(way, nodes)
            if len(pts) < 2:
                continue
            
            polyline_str = points_to_polyline(pts)
            
            if wtype == 'river':
                name = tags.get('name', '')
                width = '12' if 'Ottawa' in name else ('6' if 'Rideau' in name else '4')
                svg_parts.append(f'<polyline points="{polyline_str}" '
                               f'stroke="{STYLES["water_fill"]}" stroke-width="{int(width)+6}" opacity="0.5"/>')
                svg_parts.append(f'<polyline points="{polyline_str}" '
                               f'stroke="{STYLES["water_stroke"]}" stroke-width="{width}" opacity="0.6"/>')
            elif wtype == 'canal':
                svg_parts.append(f'<polyline points="{polyline_str}" '
                               f'stroke="{STYLES["canal_stroke"]}" stroke-width="3" opacity="0.5"/>')
        svg_parts.append('</g>')
    else:
        print("Warning: osm_water.json not found, skipping waterways")
    
    # ===== ROADS =====
    if roads_file.exists():
        nodes, ways = parse_osm_json(roads_file)
        print(f"Roads: {len(nodes)} nodes, {len(ways)} ways")
        
        svg_parts.append(f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">')
        for way in ways:
            tags = way.get('tags', {})
            htype = tags.get('highway', '')
            pts = way_to_points(way, nodes)
            if len(pts) < 2:
                continue
            
            polyline_str = points_to_polyline(pts)
            
            if htype == 'motorway':
                svg_parts.append(f'<polyline points="{polyline_str}" '
                               f'stroke="{STYLES["motorway"]}" stroke-width="2.5" opacity="0.35"/>')
            elif htype == 'trunk':
                svg_parts.append(f'<polyline points="{polyline_str}" '
                               f'stroke="{STYLES["trunk"]}" stroke-width="1.8" opacity="0.3"/>')
            elif htype == 'primary':
                svg_parts.append(f'<polyline points="{polyline_str}" '
                               f'stroke="{STYLES["primary"]}" stroke-width="1.2" opacity="0.2"/>')
        svg_parts.append('</g>')
    else:
        print("Warning: osm_roads.json not found, skipping roads")
    
    # ===== NEIGHBOURHOOD LABELS =====
    svg_parts.append('<g font-family="Outfit, sans-serif">')
    for name, lat, lon in NEIGHBOURHOODS:
        x, y = lat_lon_to_xy(lat, lon)
        svg_parts.append(f'<text x="{x}" y="{y}" text-anchor="middle" '
                        f'fill="{STYLES["neighbourhood"]}" font-size="11" '
                        f'font-weight="400" opacity="0.4">{name}</text>')
    svg_parts.append('</g>')
    
    # Close SVG
    svg_parts.append('</svg>')
    
    return '\n'.join(svg_parts)


if __name__ == '__main__':
    svg_content = build_svg()
    
    output_path = Path(__file__).parent.parent / 'frontend' / 'assets' / 'ottawa_map.svg'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    
    file_size = output_path.stat().st_size / 1024
    print(f"SVG written to {output_path} ({file_size:.1f} KB)")
