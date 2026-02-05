import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Processing directories
SEPARATED_DIR = UPLOAD_DIR / "separated"
SEPARATED_DIR.mkdir(exist_ok=True)

# Performance & Model settings
WHISPER_MODEL_NAME = "medium"
DEMUCS_MODEL_NAME = "htdemucs"

# FFmpeg settings
FFMPEG_SEARCH_PATHS = [
    "C:\\ffmpeg\\bin",
    "C:\\Program Files\\ffmpeg\\bin",
    "C:\\ProgramData\\chocolatey\\bin"
]

def setup_ffmpeg():
    """Setup FFmpeg paths for various libraries."""
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = str(Path(ffmpeg_exe).parent)
        
        paths_to_add = [ffmpeg_dir]
        for p in FFMPEG_SEARCH_PATHS:
            if os.path.exists(p):
                paths_to_add.append(p)
        
        # Prepend to PATH
        new_path = os.pathsep.join(paths_to_add) + os.pathsep + os.environ.get("PATH", "")
        os.environ["PATH"] = new_path
        
        # Specific env vars for libraries
        os.environ["FFMPEG_BINARY"] = ffmpeg_exe
        os.environ["IMAGEIO_FFMPEG_EXE"] = ffmpeg_exe
        
        print(f"FFmpeg configured. Paths added: {paths_to_add}")
        return True
    except Exception as e:
        print(f"Warning: FFmpeg setup encountered issues: {e}")
        return False
