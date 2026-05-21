from __future__ import annotations

import os
import tempfile
import uuid

import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field


router = APIRouter(tags=["tts"])


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1)
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: str = "+0%"
    volume: str = "+0%"
    pitch: str = "+0Hz"


@router.post("/tts")
async def synthesize_tts(request: TtsRequest) -> Response:
    try:
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

            with open(tmp_path, "rb") as audio_file:
                audio_data = audio_file.read()

            return Response(
                content=audio_data,
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": f"attachment; filename=tts_{uuid.uuid4().hex[:8]}.mp3"
                },
            )
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS conversion failed: {exc}") from exc


@router.get("/voices")
async def list_tts_voices() -> JSONResponse:
    try:
        voices = await edge_tts.list_voices()
        return JSONResponse({"success": True, "voices": voices})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices: {exc}") from exc
