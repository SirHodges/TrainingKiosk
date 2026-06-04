import os
from pathlib import Path
f = Path('test_touch.txt')
f.touch()
print("First touch")
f.touch()
print("Second touch")
