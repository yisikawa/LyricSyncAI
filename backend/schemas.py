from pydantic import BaseModel
from typing import List, Optional

class Segment(BaseModel):
    id: int
    start: float
    end: float
    text: str

class TranscribeRequest(BaseModel):
    filename: str = "vocals.wav"

class SeparateRequest(BaseModel):
    filename: str
    rvc_model: Optional[str] = None
    index_file: Optional[str] = None

class ExportRequest(BaseModel):
    video_filename: str
    segments: List[Segment]
    use_original_voice: bool = False
