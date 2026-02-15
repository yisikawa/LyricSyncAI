import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    upload_dir: Path = Path("uploads")
    whisper_model: str = "medium"
    demucs_model: str = "htdemucs"
    api_port: int = 8001
    ffmpeg_path: str = "ffmpeg"  # Default to 'ffmpeg' in PATH
    
    rvc_model_path: Path = Path("models/rvc/model.pth")
    rvc_index_path: Path = Path("models/rvc/model.index")
    rvc_f0_method: str = "rmvpe"

    @property
    def rvc_output_dir(self) -> Path:
        return self.upload_dir / "converted"

    @property
    def separated_dir(self) -> Path:
        return self.upload_dir / "separated"
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }

settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.separated_dir.mkdir(parents=True, exist_ok=True)
settings.rvc_output_dir.mkdir(parents=True, exist_ok=True)

if not settings.rvc_model_path.parent.exists():
    settings.rvc_model_path.parent.mkdir(parents=True, exist_ok=True)

# Legacy constants for compatibility
UPLOAD_DIR = settings.upload_dir
WHISPER_MODEL_NAME = settings.whisper_model
DEMUCS_MODEL_NAME = settings.demucs_model

# Constants
BANNED_PHRASES = [
    "視聴ありがとうございました",
    "チャンネル登録",
    "高評価",
    "Subtitles by",
    "Translated by",
    "ご視聴",
    "Thanks for watching",
    "Subscribe",
    "Like and Subscribe"
]

WHISPER_SETTINGS = {
    "beam_size": 5,
    "best_of": 5,
    "temperature": [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    "log_prob_threshold": -1.0,
    "no_speech_threshold": 0.6,
    "condition_on_previous_text": False,
    "initial_prompt": "歌詞の字幕を作成します。歌の歌詞を書き起こしてください。"
}

def setup_ffmpeg():
    """
    Ensure FFmpeg is available in the system path.
    """
    import shutil
    import os
    
    # If a full path is provided in config, add its directory to PATH
    ffmpeg_path = settings.ffmpeg_path
    if os.path.isabs(ffmpeg_path):
        ffmpeg_bin_dir = str(Path(ffmpeg_path).parent)
        if ffmpeg_bin_dir not in os.environ["PATH"]:
            os.environ["PATH"] = ffmpeg_bin_dir + os.pathsep + os.environ["PATH"]
            print(f"Added {ffmpeg_bin_dir} to PATH")

    # Final check
    if shutil.which("ffmpeg") is None:
        print("!!! Warning: ffmpeg not found in PATH. Video processing will FAIL. !!!")
        print("Please install FFmpeg and set FFMPEG_PATH in .env or ensure it is in your system PATH.")
    else:
        print(f"FFmpeg confirmed: {shutil.which('ffmpeg')}")

