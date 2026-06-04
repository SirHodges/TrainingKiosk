"""
Business logic for scanning and analyzing media files (videos, PDFs).

This module handles looking through the content directory to find categories,
skills, and files. It also checks if files are new based on their modification date.
"""

import os
from pathlib import Path
from datetime import datetime, timedelta

from server.config import NEW_CONTENT_DAYS, SUPPORTED_EXTENSIONS

def is_new_file(filepath: Path) -> bool:
    """
    Checks if a file has been modified recently (within NEW_CONTENT_DAYS).
    
    Args:
        filepath: Path object pointing to the file to check
        
    Returns:
        True if the file is considered new, False otherwise
    """
    try:
        mtime = os.path.getmtime(filepath)
        file_date = datetime.fromtimestamp(mtime)
        cutoff_date = datetime.now() - timedelta(days=NEW_CONTENT_DAYS)
        return file_date >= cutoff_date
    except OSError:
        return False

def find_logo_for_skill(skill_dir: Path) -> str:
    """
    Looks for an image file to use as the logo for a skill.
    It expects the image to have the same name as the folder.
    
    Args:
        skill_dir: Path object pointing to the skill folder
        
    Returns:
        The filename of the logo if found, or None if not found
    """
    skill_name = skill_dir.name
    possible_extensions = ['.jpg', '.jpeg', '.png']
    
    for ext in possible_extensions:
        logo_path = skill_dir / f"{skill_name}{ext}"
        if logo_path.exists():
            return logo_path.name
            
    return None

def scan_categories(content_dir: Path) -> list:
    """
    Scans the main content directory to find categories.
    A category is considered "new" if it contains any "new" skills.
    
    Args:
        content_dir: The root content directory
        
    Returns:
        A list of dictionaries containing category information
    """
    categories = []
    
    if not content_dir.exists():
        return categories
        
    for item in content_dir.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            # Check if this category has any new content inside it
            is_new = False
            skills = scan_skills(content_dir, item.name)
            for skill in skills:
                if skill.get('is_new'):
                    is_new = True
                    break
                    
            categories.append({
                'name': item.name,
                'is_new': is_new
            })
            
    # Sort alphabetically for consistent display
    return sorted(categories, key=lambda x: x['name'])

def scan_skills(content_dir: Path, category: str) -> list:
    """
    Scans a category folder to find skill folders.
    A skill is considered "new" if it contains any "new" files.
    
    Args:
        content_dir: The root content directory
        category: The name of the category to look inside
        
    Returns:
        A list of dictionaries containing skill information
    """
    skills = []
    category_path = content_dir / category
    
    if not category_path.exists() or not category_path.is_dir():
        return skills
        
    for item in category_path.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            # Check if this skill has any new content
            is_new = False
            files = scan_files(content_dir, category, item.name)
            for f in files:
                if f.get('is_new'):
                    is_new = True
                    break
                    
            logo = find_logo_for_skill(item)
            
            skills.append({
                'id': item.name.lower().replace(' ', '_'),
                'name': item.name,
                'category': category,
                'logo': logo,
                'is_new': is_new
            })
            
    return sorted(skills, key=lambda x: x['name'])

def scan_files(content_dir: Path, category: str, skill: str) -> list:
    """
    Scans a skill folder to find playable media files (videos, PDFs).
    
    Args:
        content_dir: The root content directory
        category: The name of the category
        skill: The name of the skill
        
    Returns:
        A list of dictionaries containing file information
    """
    files = []
    skill_path = content_dir / category / skill
    
    if not skill_path.exists() or not skill_path.is_dir():
        return files
        
    for item in skill_path.iterdir():
        if item.is_file() and not item.name.startswith('.'):
            # Check if it's a supported file type
            if item.suffix.lower() in SUPPORTED_EXTENSIONS:
                file_type = 'pdf' if item.suffix.lower() == '.pdf' else 'video'
                
                files.append({
                    'id': item.name.lower().replace(' ', '_').replace('.', '_'),
                    'name': item.stem, # Filename without extension
                    'filename': item.name, # Full filename
                    'skill': skill,
                    'category': category,
                    'type': file_type,
                    'is_new': is_new_file(item)
                })
                
    return sorted(files, key=lambda x: x['name'])
