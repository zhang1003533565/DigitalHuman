#!/usr/bin/env python3
"""
Standalone Edge TTS FastAPI service app.
"""

import os
import uuid

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from model_capabilities.tts.edge_tts_adapter import list_voice_short_names, synthesize_voice_to_file
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
    try:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tmp_path = tmp_file.name

        try:
            await synthesize_voice_to_file(
                request.text,
                request.voice,
                tmp_path,
                rate=request.rate,
                volume=request.volume,
                pitch=request.pitch,
            )

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
        raise HTTPException(status_code=500, detail="TTS conversion failed") from e


@app.get("/voices")
async def voices_handler():
    try:
        voices = await list_voice_short_names()
        return JSONResponse({"success": True, "voices": voices})
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch voices") from e


@app.get("/health")
async def health_handler():
    return {"status": "ok"}


def main():
    host = os.getenv("EDGE_TTS_HOST", "127.0.0.1")
    port = int(os.getenv("EDGE_TTS_PORT", "18754"))
    uvicorn.run("model_capabilities.tts.service_app:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
