import os
import sys
import traceback
from pathlib import Path

import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.audio import AudioFile
from demucs.pretrained import get_model
from faster_whisper import WhisperModel

from config import (BANNED_PHRASES, DEMUCS_MODEL_NAME, UPLOAD_DIR,
                    WHISPER_MODEL_NAME, WHISPER_SETTINGS, setup_ffmpeg)

# Initialize FFmpeg on module load
setup_ffmpeg()

try:
    from moviepy.video.io.VideoFileClip import VideoFileClip
    from moviepy.audio.io.AudioFileClip import AudioFileClip
except ImportError:
    try:
        from moviepy.editor import VideoFileClip, AudioFileClip
    except ImportError:
        from moviepy import VideoFileClip, AudioFileClip

# --- Constants ---
# BANNED_PHRASES is now imported from config

def format_timestamp(seconds: float) -> str:
    """
    Format seconds into SRT timestamp format: HH:MM:SS,mmm
    """
    ms = int((seconds - int(seconds)) * 1000)
    full_seconds = int(seconds)
    hours = full_seconds // 3600
    minutes = (full_seconds % 3600) // 60
    seconds_rem = full_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds_rem:02d},{ms:03d}"

def create_srt(segments: list, output_path: Path):
    """
    Create an SRT file from segments list.
    """
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            for i, seg in enumerate(segments):
                # Using 1-based index for SRT
                f.write(f"{i + 1}\n")
                # seg might be a dict (from Whisper) or an object (from Pydantic)
                start = seg["start"] if isinstance(seg, dict) else seg.start
                end = seg["end"] if isinstance(seg, dict) else seg.end
                text = seg["text"].strip() if isinstance(seg, dict) else seg.text.strip()
                
                f.write(f"{format_timestamp(start)} --> {format_timestamp(end)}\n")
                f.write(f"{text}\n\n")
        return True
    except Exception as e:
        print(f"Error creating SRT: {e}")
        return False

def burn_subtitles(video_path: Path, srt_path: Path, output_path: Path):
    """
    Burn subtitles into video using FFmpeg.
    """
    try:
        import ffmpeg
        
        # We need to escape the SRT path for FFmpeg subtitles filter
        # Especially on Windows where paths contain ":" and "\"
        # FFmpeg filter paths need careful escaping.
        # subtitles='C\:/path/to/sub.srt' or similar
        # Use forward slashes for Windows paths in FFmpeg filters
        srt_abs_path = str(srt_path.absolute()).replace("\\", "/")
        
        print(f"Burning subtitles from {srt_path} into {video_path}")
        
        # Add subtitles filter - using filename keyword helps with Windows path escaping in ffmpeg-python
        stream = ffmpeg.input(str(video_path))
        audio = stream.audio
        video = stream.video.filter("subtitles", filename=srt_abs_path)

        
        # Output with high quality
        out = ffmpeg.output(video, audio, str(output_path), vcodec='libx264', acodec='copy', crf=23)
        
        # Run FFmpeg
        # overwrite_output=True corresponds to -y
        out.run(overwrite_output=True, capture_stdout=True, capture_stderr=True)
        
        print(f"Burned video saved to: {output_path}")
        return True
    except Exception as e:
        if hasattr(e, 'stderr'):
            print(f"FFmpeg error: {e.stderr.decode()}")
        print(f"Error burning subtitles: {e}")
        return False

from faster_whisper import WhisperModel

class _WhisperModelManager:
    _instance = None
    _model = None
    _model_name = None

    @classmethod
    def get_model(cls, model_name: str):
        if cls._model is None or cls._model_name != model_name:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # Fast fallback or specific compute type
            compute_type = "float16" if device == "cuda" else "int8"
            
            print(f"--- Loading faster-whisper model ({model_name}) on {device} ({compute_type}) ---")
            try:
                cls._model = WhisperModel(model_name, device=device, compute_type=compute_type)
                cls._model_name = model_name
            except Exception as e:
                print(f"Failed to load model on {device}: {e}. Falling back to CPU...")
                cls._model = WhisperModel(model_name, device="cpu", compute_type="int8")
                cls._model_name = model_name
        return cls._model

def transcribe_audio_generator(audio_path: Path):
    """
    Transcribe audio using faster-whisper and yield segments one by one.
    """
    try:
        print(f"--- Start Transcription Generator: {audio_path.name} ---")
        model = _WhisperModelManager.get_model(WHISPER_MODEL_NAME)

        segments, info = model.transcribe(
            str(audio_path),
            **WHISPER_SETTINGS
        )

        print(f"Detected language: {info.language} ({info.language_probability:.2f})")

        for segment in segments:
            text = segment.text.strip()
            
            # Skip if text contains any banned phrases or is empty
            if any(phrase in text for phrase in BANNED_PHRASES) or not text:
                print(f"Skipping hallucinated or empty segment: {text}")
                continue
                
            print(f"Segment: [{segment.start:.2f} -> {segment.end:.2f}] {text}")
            yield {
                "id": segment.id,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": text
            }
            
        print("--- Transcription Generator Finished ---")

    except Exception as e:
        print(f"!!! Error in transcribe_audio_generator: {e}")
        import traceback
        traceback.print_exc()
        yield {"error": str(e)}

def transcribe_audio(audio_path: Path):
    """
    Transcribe audio using the generator and return results in the original format.
    (Kept for backward compatibility)
    """
    full_result = {
        "text": "",
        "segments": []
    }
    
    for segment in transcribe_audio_generator(audio_path):
        if "error" in segment:
            return None
        full_result["segments"].append(segment)
        full_result["text"] += segment["text"]
    
    return full_result

def extract_audio(video_path: Path, output_path: Path):
    """
    Extract audio from video file using moviepy.
    """
    try:
        video = VideoFileClip(str(video_path))
        video.audio.write_audiofile(str(output_path), logger=None)
        video.close()
        return True
    except Exception as e:
        print(f"Error extracting audio: {e}")
        return False

def separate_vocals(audio_path: Path, output_dir: Path):
    """
    Separate vocals using Demucs Python API.
    Uses AudioFile (ffmpeg) for loading and soundfile for saving.
    """
    try:
        print(f"Loading Demucs model ({DEMUCS_MODEL_NAME})...")
        model = get_model(DEMUCS_MODEL_NAME)

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)

        try:
            print(f"Attempting to load audio with Demucs AudioFile: {audio_path}")
            # Use Demucs AudioFile which wraps ffmpeg
            wav = AudioFile(audio_path).read(
                streams=0,
                samplerate=model.samplerate,
                channels=model.audio_channels
            )
        except Exception as e:
            print(f"Demucs AudioFile failed: {e}. Falling back to moviepy...")
            audio = AudioFileClip(str(audio_path))

            # Load as numpy and convert to torch
            audio_data = audio.to_soundarray(fps=model.samplerate)
            # MoviePy returns [Time, Channels], Demucs wants [Channels, Time]
            wav = torch.from_numpy(audio_data.T).float()
            audio.close()


        # Substrate Demucs normalization
        # Ref: https://github.com/facebookresearch/demucs/blob/main/demucs/separate.py
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        
        print("Starting separation...")
        # Add batch dimension: [1, Channels, Time] and apply model
        sources = apply_model(model, wav[None], device=device, shifts=1, split=True, overlap=0.25, progress=True)[0]
        
        # Denormalize to restore original amplitude
        sources = sources * ref.std() + ref.mean()

        # Save vocals and no_vocals
        output_dir.mkdir(parents=True, exist_ok=True)
        
        vocals_idx = model.sources.index('vocals')
        vocals = sources[vocals_idx]
        
        # Create no_vocals by summing everything else
        no_vocals = torch.zeros_like(vocals)
        for i, src in enumerate(sources):
            if i != vocals_idx:
                no_vocals += src
        
        # Save using soundfile
        vocals_np = vocals.cpu().numpy().T
        no_vocals_np = no_vocals.cpu().numpy().T
        
        filename_stem = audio_path.stem
        vocals_path = output_dir / f"{filename_stem}_vocals.wav"
        no_vocals_path = output_dir / f"{filename_stem}_no_vocals.wav"
        
        print(f"Saving to {vocals_path}")
        sf.write(str(vocals_path), vocals_np, model.samplerate)
        
        print(f"Saving to {no_vocals_path}")
        sf.write(str(no_vocals_path), no_vocals_np, model.samplerate)
        
        return vocals_path


    except Exception as e:
        print(f"Error separating vocals: {e}")
        import traceback
        traceback.print_exc()
        return None
