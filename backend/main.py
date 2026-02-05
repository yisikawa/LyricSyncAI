from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from pathlib import Path
from audio_processor import extract_audio, separate_vocals

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def process_video(video_path: Path):
    print(f"Starting processing for: {video_path}")
    
    # 1. Extract Audio
    audio_path = video_path.with_suffix(".mp3")
    print(f"Extracting audio to: {audio_path}")
    if extract_audio(video_path, audio_path):
        print("Audio extraction successful")
        
        # 2. Separate Vocals
        print("Starting vocal separation...")
        # Output directory for separated tracks
        separation_out_dir = UPLOAD_DIR / "separated"
        separation_out_dir.mkdir(exist_ok=True)
        
        vocals_path = separate_vocals(audio_path, separation_out_dir)
        if vocals_path:
             print(f"Vocal separation successful: {vocals_path}")
        else:
             print("Vocal separation failed")
    else:
        print("Audio extraction failed")

@app.get("/")
def read_root():
    return {"Hello": "World", "app": "LyricSyncAI"}

@app.post("/upload")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a video file.")
    
    file_path = UPLOAD_DIR / file.filename
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
    
    # Schedule background processing
    background_tasks.add_task(process_video, file_path)
        
    return {"filename": file.filename, "filepath": str(file_path), "message": "Upload successful. Processing started in background."}
