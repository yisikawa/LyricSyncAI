from pydantic import BaseModel

class TranscribeRequest(BaseModel):
    filename: str = "vocals.wav"
