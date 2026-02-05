import sys
import os
from pathlib import Path
import subprocess

# Ensure ffmpeg path via imageio_ffmpeg if available
try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = str(Path(ffmpeg_path).parent)
    os.environ["PATH"] += os.pathsep + ffmpeg_dir
    print(f"Added ffmpeg to PATH: {ffmpeg_dir}")
except ImportError:
    print("imageio-ffmpeg not found, assuming ffmpeg is in PATH")

try:
    from moviepy import VideoFileClip
except ImportError:
    from moviepy.editor import VideoFileClip

import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import AudioFile
import soundfile as sf

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
        print(f"Loading Demucs model...")
        model = get_model('htdemucs')
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)

        print(f"Loading audio: {audio_path}")
        # Use Demucs AudioFile which wraps ffmpeg
        # This bypasses torchaudio.load specific backend issues
        wav = AudioFile(audio_path).read(
            streams=0,
            samplerate=model.samplerate,
            channels=model.audio_channels
        )
        
        print("Starting separation...")
        # Add batch dimension: [1, Channels, Time]
        sources = apply_model(model, wav[None], device=device, shifts=1, split=True, overlap=0.25, progress=True)[0]
        
        # Demucs AudioFile normalizes during read? No, check separate.py
        # separate.py does normalization:
        # ref = wav.mean(0)
        # wav -= ref.mean()
        # wav /= ref.std()
        # BUT AudioFile read output is just the tensor.
        # Wait, separate.py calculates Ref AFTER loading.
        # So we should apply normalization logic if we want to retrieve original amplitude.
        
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        
        # apply_model was called with normalized wav?
        # Re-reading separate.py:
        # wav = load_track(...) 
        # ref = wav.mean(0)
        # wav -= ref.mean()
        # wav /= ref.std()
        # sources = apply_model(...)
        # sources *= ref.std()
        # sources += ref.mean()
        
        # But wait, apply_model takes the tensor. We should pass the tensor we normalized?
        # Yes. But wait, I loaded wav, normalized it in place (or reassigned), then passed to apply_model.
        # But sources is derived from apply_model output.
        # Let's be careful with variable names.
        
        # Correct logic:
        # wav_loaded = AudioFile(...).read(...)
        # ref = wav_loaded.mean(0)
        # wav_input = (wav_loaded - ref.mean()) / ref.std()
        # sources = apply_model(..., wav_input[None], ...)
        # sources = sources * ref.std() + ref.mean()
        
        # However, in my code above:
        # wav = AudioFile(...).read(...)
        # ref = wav.mean(0)
        # wav = (wav - ref.mean()) / ref.std()  <-- wav is updated
        # sources = apply_model(..., wav[None], ...) <-- uses updated wav
        # sources = sources * ref.std() + ref.mean() <-- restores amplitude
        
        # This seems correct IF AudioFile returns raw floating point audio [-1, 1].
        # AudioFile uses ffmpeg f32le, so yes.

        # Denormalize
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
        
        vocals_path = output_dir / "vocals.wav"
        no_vocals_path = output_dir / "no_vocals.wav"
        
        print(f"Saving to {vocals_path}")
        sf.write(str(vocals_path), vocals_np, model.samplerate)
        
        print(f"Saving to {no_vocals_path}")
        sf.write(str(no_vocals_path), no_vocals_np, model.samplerate)
        
        return str(vocals_path)

    except Exception as e:
        print(f"Error separating vocals: {e}")
        import traceback
        traceback.print_exc()
        return None
