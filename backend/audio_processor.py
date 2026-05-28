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
FFMPEG_CMD = setup_ffmpeg()
LAST_AUDIO_EXTRACTION_ERROR = ""

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

def burn_subtitles(video_path: Path, srt_path, output_path: Path, audio_path: Path = None):
    """
    Export video with FFmpeg, optionally burning subtitles and replacing audio.
    srt_path may be None or an empty file — subtitles are skipped in that case.
    Falls back to no-subtitle export if subtitle burning fails.
    Uses explicit stream mapping (-map 0:v:0) to skip embedded cover art.
    """
    import subprocess
    import tempfile
    import shutil

    if audio_path:
        print(f"Replacing audio with: {audio_path}")

    if output_path.exists():
        try:
            os.remove(output_path)
            print(f"Removed existing output file: {output_path}")
        except PermissionError:
            print(f"!!! Error: Cannot overwrite {output_path}. File is locked.")
            return False
        except Exception as e:
            print(f"Warning: Could not remove existing file: {e}")

    has_subtitles = (
        srt_path is not None
        and Path(srt_path).exists()
        and Path(srt_path).stat().st_size > 0
    )

    temp_srt = None

    def build_cmd(with_subtitles: bool):
        cmd = [FFMPEG_CMD, '-y', '-i', str(video_path)]
        if audio_path and audio_path.exists():
            cmd += ['-i', str(audio_path)]
        # Explicit mapping: first video stream only (skips embedded cover art / attached pic)
        cmd += ['-map', '0:v:0']
        if audio_path and audio_path.exists():
            cmd += ['-map', '1:a:0']
        else:
            cmd += ['-map', '0:a:0']
        if with_subtitles and temp_srt:
            srt_abs = str(temp_srt.absolute()).replace("\\", "/")
            # Escape drive-letter colon for FFmpeg filter string on Windows (e.g. C: -> C\:)
            if len(srt_abs) >= 2 and srt_abs[1] == ':':
                srt_abs = srt_abs[0] + '\\:' + srt_abs[2:]
            cmd += ['-vf', f"subtitles=filename='{srt_abs}'"]
        cmd += ['-vcodec', 'libx264', '-acodec', 'aac', '-crf', '23', str(output_path)]
        return cmd

    def run_cmd(cmd):
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            stderr_str = result.stderr.decode('utf-8', errors='replace')
            print(f"FFmpeg error: {stderr_str}")
            raise RuntimeError("ffmpeg failed")

    try:
        if has_subtitles:
            print(f"Burning subtitles from {srt_path} into {video_path}")
            # Copy SRT to a temp ASCII-named file to avoid libass non-ASCII path issues on Windows
            with tempfile.NamedTemporaryFile(suffix='.srt', delete=False) as tf:
                temp_srt = Path(tf.name)
            shutil.copy2(srt_path, temp_srt)
        else:
            print("No subtitles — exporting video without subtitle filter.")

        try:
            run_cmd(build_cmd(with_subtitles=has_subtitles))
            print(f"Exported video saved to: {output_path}")
            return True
        except RuntimeError:
            if has_subtitles:
                print("Subtitle burning failed — retrying without subtitles...")
                try:
                    run_cmd(build_cmd(with_subtitles=False))
                    print(f"Exported video (without subtitles) saved to: {output_path}")
                    return True
                except RuntimeError:
                    print("Fallback export also failed.")
            return False

    except Exception as e:
        print(f"Error during export: {e}")
        return False

    finally:
        if temp_srt and temp_srt.exists():
            try:
                temp_srt.unlink()
            except Exception:
                pass

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
    Extract audio from video file using ffmpeg-python.
    moviepy is unreliable with non-ASCII filenames and audio-less streams.
    """
    global LAST_AUDIO_EXTRACTION_ERROR
    LAST_AUDIO_EXTRACTION_ERROR = ""
    try:
        import ffmpeg as ffmpeg_lib
        (
            ffmpeg_lib
            .input(str(video_path))
            .audio
            .output(str(output_path))
            .overwrite_output()
            .run(cmd=FFMPEG_CMD, capture_stdout=True, capture_stderr=True)
        )
        return True
    except Exception as e:
        stderr = getattr(e, 'stderr', None)
        if stderr:
            stderr_text = stderr.decode(errors='replace')
            print(f"FFmpeg error: {stderr_text}")
            if "matches no streams" in stderr_text or "Stream map" in stderr_text:
                LAST_AUDIO_EXTRACTION_ERROR = "動画に音声トラックがありません。音声付きの動画を選択してください。"
            else:
                LAST_AUDIO_EXTRACTION_ERROR = stderr_text.splitlines()[-1] if stderr_text.splitlines() else str(e)
        else:
            LAST_AUDIO_EXTRACTION_ERROR = str(e)
        print(f"Error extracting audio: {e}")
        return False

def get_last_audio_extraction_error() -> str:
    return LAST_AUDIO_EXTRACTION_ERROR

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
        
        return vocals_path, no_vocals_path


    except Exception as e:
        print(f"Error separating vocals: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def mix_audio(vocal_path: Path, inst_path: Path, output_path: Path, vocal_volume: float = 1.0, inst_volume: float = 1.0):
    """
    Mix vocal and instrumental tracks with volume adjustments using FFmpeg.
    """
    try:
        import ffmpeg
        
        if not vocal_path.exists() or not inst_path.exists():
            print(f"One of the input files for mixing does not exist: {vocal_path}, {inst_path}")
            return False

        print(f"Mixing audio: {vocal_path} + {inst_path} -> {output_path}")

        # Input streams with volume adjustment
        # Note: volume filter accepts a number (1.0 = original, 0.5 = half, etc.)
        vocal = ffmpeg.input(str(vocal_path)).filter('volume', volume=vocal_volume)
        inst = ffmpeg.input(str(inst_path)).filter('volume', volume=inst_volume)
        
        # amix filter mixes multiple audio streams. duration='longest' preserves full length if one is shorter (usually same length)
        # dropout_transition=0 prevents volume drops
        mixed = ffmpeg.filter([vocal, inst], 'amix', inputs=2, duration='longest')
        
        # Output as MP3 or WAV depending on extension
        out = ffmpeg.output(mixed, str(output_path), audio_bitrate='192k')
        
        out.run(cmd=FFMPEG_CMD, overwrite_output=True, quiet=True)
        
        print(f"Mixed audio saved to: {output_path}")
        return True
    except ffmpeg.Error as e:
        if hasattr(e, 'stderr') and e.stderr:
            print(f"FFmpeg error: {e.stderr.decode()}")
        else:
            print(f"FFmpeg or other error during mixing: {e}")
        return False
    except Exception as e:
        print(f"Error mixing audio: {e}")
        import traceback
        traceback.print_exc()
        return False

