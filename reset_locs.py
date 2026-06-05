import os
import sys

# Add the current directory to sys.path
sys.path.insert(0, os.path.abspath('.'))

from server.database import get_db, import_geogame_locations

def main():
    with get_db() as db:
        db.execute('DELETE FROM geogame_locations')
        db.commit()
    import_geogame_locations()
    print("Locations Reset Successfully from ottawa_locations.json")

if __name__ == '__main__':
    main()
