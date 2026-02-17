from pathlib import Path
from audio_processor import extract_audio, separate_vocals, transcribe_audio, create_srt, burn_subtitles
from config import settings, load_ai_params

def get_upload_dir() -> Path:
    return settings.upload_dir

def generate_ai_cover(video_path: Path, vocals_path: Path):
    """
    Generate AI Cover by converting vocals and mixing with instrumental.
    Returns the path to the mixed audio file if successful, otherwise None.
    """
    try:
        from rvc_inference import get_rvc_wrapper
        from audio_processor import mix_audio
        
        rvc = get_rvc_wrapper()
        
        # Load params
        params = load_ai_params()
        rvc_params = params.get("rvc", {})

        model_filename = rvc_params.get("model_filename", "model.pth")
        index_filename = rvc_params.get("index_filename", "model.index")
        
        # Construct full paths using config directory
        model_path = settings.rvc_model_dir / model_filename
        index_path = settings.rvc_model_dir / index_filename

        # Check if model exists
        if not model_path.exists():
            print(f"RVC model not found at {model_path}. Skipping.")
            return None

        print(f"Starting Voice Conversion with model: {model_path.name}")
        
        # Load Model
        if rvc.load_model(model_path, index_path):
            
            converted_vocals_path = settings.rvc_output_dir / f"{video_path.stem}_converted.wav"
            
            # Infer
            if rvc.infer(
                vocals_path, 
                converted_vocals_path, 
                pitch_change=rvc_params.get("pitch_change", 0), 
                f0_method=rvc_params.get("f0_method", "rmvpe"),
                index_rate=rvc_params.get("index_rate", 0.75)
            ):
                print(f"Voice Conversion successful: {converted_vocals_path}")
                
                # Mix with Instrumental - DISABLED based on user feedback
                # no_vocals_path = settings.separated_dir / f"{video_path.stem}_no_vocals.wav"
                # mixed_output_path = settings.upload_dir / f"ai_cover_{video_path.stem}.mp3"
                
                # if no_vocals_path.exists():
                #     if mix_audio(converted_vocals_path, no_vocals_path, mixed_output_path):
                #         print(f"AI Cover created successfully: {mixed_output_path}")
                #         return mixed_output_path
                #     else:
                #         print("Mixing failed")
                # else:
                #     print(f"Instrumental track not found: {no_vocals_path}")

                # Return only converted vocals (Acapella)
                import shutil
                ai_vocal_path = settings.upload_dir / f"ai_cover_{video_path.stem}.wav"
                shutil.copy(str(converted_vocals_path), str(ai_vocal_path))
                print(f"AI Vocal produced: {ai_vocal_path}")
                return ai_vocal_path
            else:
                print("Voice Conversion failed")
        else:
                print("Failed to load RVC model")
    except Exception as e:
        print(f"Error during Voice Conversion phase: {e}")
        import traceback
        traceback.print_exc()
    
    return None

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
        separation_out_dir = settings.separated_dir
        
        vocals_path, _ = separate_vocals(audio_path, separation_out_dir)
        if vocals_path:
             print(f"Vocal separation successful: {vocals_path}")
             
             # 3. Voice Conversion (RVC) & Mixing
             generate_ai_cover(video_path, vocals_path)
             
        else:
             print("Vocal separation failed")
    else:
        print("Audio extraction failed")

def perform_transcription_generator(filename: str):
    """
    Perform transcription as a generator. Prioritize separated vocals if available.
    """
    # If filename is a URL, extract the relative path from /uploads/
    if filename.startswith("http"):
        if "/uploads/" in filename:
            filename = filename.split("/uploads/")[1]
        else:
            filename = Path(filename).name
            
    # Now filename is either "demo3.mp4" OR "separated/demo3_vocals.wav"
    input_path = settings.upload_dir / filename
    
    # Logic for finding best audio source:
    # 1. If filename specifically points to a file, use it.
    # 2. If it's a video, check if there's a separated vocal track.
    # 3. If no vocal track, check if there's an extracted audio track.
    
    target_path = None
    
    if input_path.exists() and input_path.is_file():
        # If the input specifically points to a separated track or extracted audio, use it directly
        if "separated" in str(input_path) or input_path.suffix in [".mp3", ".wav"]:
             target_path = input_path
    
    # If we don't have a direct target yet, try to find alternates based on the video filename
    if not target_path:
        video_path = settings.upload_dir / filename
        vocals_path = settings.separated_dir / f"{video_path.stem}_vocals.wav"
        audio_path = settings.upload_dir / video_path.with_suffix(".mp3").name
        
        print(f"--- Searching for audio sources for: {filename} ---")
        print(f"  Vocals: {vocals_path}")
        print(f"  Audio: {audio_path}")
        
        if vocals_path.exists():
            target_path = vocals_path
        elif audio_path.exists():
            target_path = audio_path
        elif video_path.exists():
            target_path = video_path
    
    if not target_path or not target_path.exists():
        print(f"--- ERROR: No audio source found for {filename}")
        yield {"error": "No audio source found"}
        return
         
    try:
        from audio_processor import transcribe_audio_generator
        yield from transcribe_audio_generator(target_path)
    except Exception as e:
        print(f"!!! Error in perform_transcription_generator: {e}")
        yield {"error": str(e)}

def perform_transcription(filename: str):
    """
    Perform transcription. Prioritize separated vocals if available.
    (Wrapped around generator for compatibility)
    """
    full_result = {"text": "", "segments": []}
    for segment in perform_transcription_generator(filename):
        if "error" in segment:
            return None
        full_result["segments"].append(segment)
        full_result["text"] += segment["text"]
    return full_result



def export_video_with_subtitles(video_filename: str, segments: list):
    """
    Export video with burned subtitles based on provided segments.
    """
    video_path = settings.upload_dir / video_filename
    if not video_path.exists():
        return None
        
    # 1. Create SRT file
    srt_path = video_path.with_suffix(".srt")
    if not create_srt(segments, srt_path):
        return None
        
    # 2. Burn subtitles
    output_filename = f"exported_{video_filename}"
    output_path = settings.upload_dir / output_filename
    
    # Check for AI Cover (Vocal only) and Instrumental to create a mixed audio track
    # AI Vocal: uploads/ai_cover_{stem}.wav
    # Instrumental: uploads/separated/{stem}_no_vocals.wav
    
    ai_vocal_path = settings.upload_dir / f"ai_cover_{video_path.stem}.wav"
    no_vocals_path = settings.separated_dir / f"{video_path.stem}_no_vocals.wav"
    
    replacement_audio_path = None
    
    if ai_vocal_path.exists() and no_vocals_path.exists():
        print(f"Found AI Vocal and Instrumental. Mixing for export...")
        
        params = load_ai_params()
        mix_params = params.get("mixing", {})
        
        try:
            from audio_processor import mix_audio
            mixed_audio_path = settings.upload_dir / f"mixed_export_{video_path.stem}.mp3"
            
            # Mix with params
            if mix_audio(
                ai_vocal_path, 
                no_vocals_path, 
                mixed_audio_path,
                vocal_volume=mix_params.get("vocal_volume", 1.0),
                inst_volume=mix_params.get("inst_volume", 1.0)
            ):
                 replacement_audio_path = mixed_audio_path
                 print(f"Using mixed AI audio for export: {mixed_audio_path}")
            else:
                 print("Mixing failed, falling back to original audio.")
        except Exception as e:
            print(f"Error mixing audio for export: {e}")
    
    if burn_subtitles(video_path, srt_path, output_path, audio_path=replacement_audio_path):
        return output_filename
    
    return None
