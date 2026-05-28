# Trigger Reload 2
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from pathlib import Path

from services import process_video_background, perform_transcription, get_upload_dir, export_video_with_subtitles
from schemas import TranscribeRequest, ExportRequest

from config import settings

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5150",
    "https://localhost:5150",
    "http://192.168.111.10:5150",
    "https://192.168.111.10:5150",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = settings.upload_dir

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"Hello": "World", "app": "LyricSyncAI"}

@app.post("/upload")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="無効なファイル形式です。動画ファイルをアップロードしてください。")
    
    file_path = UPLOAD_DIR / file.filename
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ファイルの保存に失敗しました: {str(e)}")
    
    # Schedule background processing
    background_tasks.add_task(process_video_background, file_path)
        
    return {"filename": file.filename, "filepath": str(file_path), "message": "アップロードが完了しました。バックグラウンドで処理を開始します。"}

@app.post("/transcribe")
def transcribe_endpoint(request: TranscribeRequest):
    result = perform_transcription(request.filename)
    
    if result is None:
        # result is None can mean file not found or transcription error.
        # Ideally services should raise exceptions or return result codes.
        # For now assuming generic failure if None, but we should check if file exists in services logic.
        # Actually perform_transcription returns None if file not found OR transcription error (though transcribe_audio returns None on error).
        # Simpler: Main relies on service. Service returns None -> Error.
        raise HTTPException(status_code=500, detail="文字起こしに失敗しました（ファイルが見つからないか、処理エラー）")
        
    if result:
        print(f"Transcription result: {len(result.get('segments', []))} segments found.")
        if result.get("segments"):
            print(f"First segment: {result['segments'][0].get('text')}")

    return {"text": result["text"], "segments": result["segments"]}

from fastapi.responses import FileResponse, StreamingResponse
import json
import mimetypes
from services import perform_transcription_generator

@app.post("/transcribe-live")
async def transcribe_live_endpoint(request: TranscribeRequest):
    def event_generator():
        for segment in perform_transcription_generator(request.filename):
            # JSON formatted data with newline for streaming
            # ensure_ascii=False to correctly handle Japanese characters
            yield json.dumps(segment, ensure_ascii=False) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@app.post("/separate")
async def separate_endpoint(request: TranscribeRequest, req: Request):
    video_path = UPLOAD_DIR / request.filename
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="動画ファイルが見つかりません")
        
    audio_path = video_path.with_suffix(".mp3")
    
    from audio_processor import extract_audio, separate_vocals
    
    # 1. Extract Audio
    if not extract_audio(video_path, audio_path):
        raise HTTPException(status_code=500, detail="音声の抽出に失敗しました")
        
    # 2. Separate Vocals
    vocals_path, no_vocals_path = separate_vocals(audio_path, settings.separated_dir)
    if not vocals_path:
        raise HTTPException(status_code=500, detail="ボーカルの分離に失敗しました")
        
    # 3. RVC Conversion (Phase 1)
    # RVC uses vocals_path, but mixing will use no_vocals_path (handled inside generate_ai_cover via filename assumption,
    # or ideally passed explicitly. For now keeping as is since generate_ai_cover was written to find it.)
    
    from services import generate_ai_cover
    ai_cover_path = generate_ai_cover(video_path, vocals_path)
    
    base = str(req.base_url).rstrip("/")
    response_data = {
        "vocals_url": f"{base}/uploads/separated/{Path(vocals_path).name}",
        "instrumental_url": f"{base}/uploads/separated/{Path(no_vocals_path).name}",
        "message": "分離が完了しました"
    }

    if ai_cover_path:
        response_data["ai_cover_url"] = f"{base}/uploads/{Path(ai_cover_path).name}"
        response_data["message"] += "（AI歌声変換も完了しました）"
        
    return response_data

@app.post("/export")
async def export_endpoint(request: ExportRequest, req: Request):
    output_filename = export_video_with_subtitles(request.video_filename, request.segments, request.use_original_voice)

    if output_filename is None:
        raise HTTPException(status_code=500, detail="動画の書き出しに失敗しました")

    base = str(req.base_url).rstrip("/")
    return {
        "filename": output_filename,
        "url": f"{base}/uploads/{output_filename}",
        "download_url": f"{base}/download/{output_filename}"
    }

@app.get("/download/{filename:path}")
async def download_file(filename: str):
    upload_root = UPLOAD_DIR.resolve()
    file_path = (upload_root / filename).resolve()

    if upload_root != file_path and upload_root not in file_path.parents:
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type,
    )
