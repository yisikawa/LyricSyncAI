from pydantic import BaseModel
from typing import List

class Segment(BaseModel):
    id: int
    start: float
    end: float
    text: str

class TranscribeRequest(BaseModel):
    filename: str = "vocals.wav"

class ExportRequest(BaseModel):
    video_filename: str
    segments: List[Segment]
