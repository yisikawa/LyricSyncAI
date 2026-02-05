from pathlib import Path
from audio_processor import extract_audio, separate_vocals
import sys

# Define clean paths
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
VIDEO_PATH = UPLOAD_DIR / "demo.mp4"
AUDIO_PATH = VIDEO_PATH.with_suffix(".mp3")
SEPARATION_OUT_DIR = UPLOAD_DIR / "separated"

print(f"Python executable: {sys.executable}")
print(f"Target Video: {VIDEO_PATH}")

if not VIDEO_PATH.exists():
    print(f"Error: Video file not found: {VIDEO_PATH}")
    sys.exit(1)

# 1. Extract Audio
print(f"--- Step 1: Extract Audio ---")
if extract_audio(VIDEO_PATH, AUDIO_PATH):
    print("Audio extraction successful")
else:
    print("Audio extraction failed")
    sys.exit(1)

# 2. Separate Vocals
print(f"--- Step 2: Separate Vocals ---")
SEPARATION_OUT_DIR.mkdir(exist_ok=True)
vocals_path = separate_vocals(AUDIO_PATH, SEPARATION_OUT_DIR)

if vocals_path:
    print(f"Vocal separation successful: {vocals_path}")
else:
    print("Vocal separation failed")
    sys.exit(1)
