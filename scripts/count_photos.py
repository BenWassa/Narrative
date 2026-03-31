import os
from pathlib import Path

def count_files_in_directories(directories):
    """
    Counts files in each specified directory recursively and prints a summary.
    """
    for dir_path in directories:
        path = Path(dir_path)
        if not path.exists():
            print(f"Directory not found: {dir_path}")
            continue
            
        print(f"\n📁 {path.name}")
        print(f"Path: {path}")
        
        # Count files by walking through the directory
        for root, dirs, files in os.walk(path):
            # Calculate depth for visual indentation
            depth = len(Path(root).relative_to(path).parts)
            indent = "  " * depth
            
            # Count only files in the current root
            file_count = len(files)
            
            # Print the directory and its file count
            dir_name = Path(root).name if depth > 0 else "."
            print(f"{indent}├── {dir_name}/ ({file_count} files)")

if __name__ == "__main__":
    target_directories = [
        '/Users/benjaminhaddon/Documents/Personal/Photos/V&B/Toronto Zoo 2025',
        '/Users/benjaminhaddon/Documents/Personal/Photos/V&B/Salmon Run at Humber 2025',
        '/Users/benjaminhaddon/Documents/Personal/Photos/V&B/Water Treatment Plant 2026',
        '/Users/benjaminhaddon/Documents/Personal/Photos/V&B/Chesterton Shores 2026',
        '/Users/benjaminhaddon/Documents/Personal/Photos/V&B/Lynde Shores 2026'
    ]
    
    count_files_in_directories(target_directories)
