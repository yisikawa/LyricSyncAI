from pathlib import Path
from audio_processor import extract_audio, separate_vocals, transcribe_audio, create_srt, burn_subtitles
from config import UPLOAD_DIR, SEPARATED_DIR

def get_upload_dir() -> Path:
    return UPLOAD_DIR


def process_video_background(video_path: Path):
    """
    Process uploaded video in background: extract audio and separate vocals.
    """
    print(f"Starting processing for: {video_path}")
    
    # 1. Extract Audio
    audio_path = video_path.with_suffix(".mp3")
    print(f"Extracting audio to: {audio_path}")
    if extract_audio(video_path, audio_path):
        print("Audio extraction successful")
        
        # 2. Separate Vocals
        print("Starting vocal separation...")
        # Output directory for separated tracks
        separation_out_dir = SEPARATED_DIR
        
        vocals_path = separate_vocals(audio_path, separation_out_dir)
        if vocals_path:
             print(f"Vocal separation successful: {vocals_path}")
        else:
             print("Vocal separation failed")
    else:
        print("Audio extraction failed")

def perform_transcription(filename: str):
    """
    Perform transcription. Prioritize separated vocals if available.
    """
    # 1. Check for separated vocals first
    video_path = UPLOAD_DIR / filename
    vocals_path = SEPARATED_DIR / f"{video_path.stem}_vocals.wav"
    audio_path = UPLOAD_DIR / video_path.with_suffix(".mp3").name
    
    print(f"--- Transcription Request ---")
    print(f"Target Video: {filename}")
    print(f"Looking for Vocals: {vocals_path}")
    print(f"Looking for Audio: {audio_path}")
    
    if vocals_path.exists():
        print(f"--- OK: Using separated vocals: {vocals_path}")
        target_path = vocals_path
    elif audio_path.exists():
        print(f"--- OK: Using extracted audio: {audio_path}")
        target_path = audio_path
    elif video_path.exists():
        print(f"--- OK: Using original video file: {video_path}")
        target_path = video_path
    else:
        print(f"--- ERROR: No audio source found for {filename}")
        return None
         
    return transcribe_audio(target_path)



def export_video_with_subtitles(video_filename: str, segments: list):
    """
    Export video with burned subtitles based on provided segments.
    """
    video_path = UPLOAD_DIR / video_filename
    if not video_path.exists():
        return None
        
    # 1. Create SRT file
    srt_path = video_path.with_suffix(".srt")
    if not create_srt(segments, srt_path):
        return None
        
    # 2. Burn subtitles
    output_filename = f"exported_{video_filename}"
    output_path = UPLOAD_DIR / output_filename
    
    if burn_subtitles(video_path, srt_path, output_path):
        return output_filename
    
    return None
