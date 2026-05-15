#!/usr/bin/env python3
"""
Edge TTS FastAPI service.
"""

import os
import uuid

import edge_tts
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field


app = FastAPI(title="Edge TTS Service")


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1)
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: str = "+0%"
    volume: str = "+0%"
    pitch: str = "+0Hz"


@app.post("/tts")
async def tts_handler(request: TtsRequest):
    """Handle TTS synthesis requests."""
    try:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tmp_path = tmp_file.name

        try:
            communicate = edge_tts.Communicate(
                request.text,
                request.voice,
                rate=request.rate,
                volume=request.volume,
                pitch=request.pitch,
            )
            await communicate.save(tmp_path)

            with open(tmp_path, "rb") as f:
                audio_data = f.read()

            os.unlink(tmp_path)

            return Response(
                content=audio_data,
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": (
                        f"attachment; filename=tts_{uuid.uuid4().hex[:8]}.mp3"
                    )
                },
            )
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS conversion failed: {str(e)}")


@app.get("/voices")
async def voices_handler():
    """Return available voices."""
    try:
        voices = await edge_tts.list_voices()
        return JSONResponse({"success": True, "voices": voices})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices: {str(e)}")


@app.get("/health")
async def health_handler():
    """Health check endpoint."""
    return {"status": "ok"}


def main():
    host = os.getenv("EDGE_TTS_HOST", "127.0.0.1")
    port = int(os.getenv("EDGE_TTS_PORT", "18754"))
    uvicorn.run("edge_tts_service:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
