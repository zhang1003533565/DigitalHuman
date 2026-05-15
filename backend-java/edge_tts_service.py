#!/usr/bin/env python3
"""
Edge TTS HTTP Service
Starts a simple HTTP server that converts text to speech using edge-tts.
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
from aiohttp import web
import edge_tts


async def tts_handler(request):
    """Handle TTS synthesis requests."""
    try:
        data = await request.json()
        text = data.get("text", "")
        voice = data.get("voice", "zh-CN-XiaoxiaoNeural")
        rate = data.get("rate", "+0%")
        volume = data.get("volume", "+0%")
        pitch = data.get("pitch", "+0Hz")

        if not text:
            return web.json_response(
                {"success": False, "message": "Text is required"},
                status=400
            )

        import tempfile
        import os
        import uuid

        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp_file:
            tmp_path = tmp_file.name

        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume, pitch=pitch)
            await communicate.save(tmp_path)

            with open(tmp_path, 'rb') as f:
                audio_data = f.read()

            os.unlink(tmp_path)

            return web.Response(
                body=audio_data,
                content_type='audio/mpeg',
                headers={
                    'Content-Disposition': f'attachment; filename=tts_{uuid.uuid4().hex[:8]}.mp3'
                }
            )
        except Exception as e:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    except Exception as e:
        return web.json_response({
            "success": False,
            "message": f"TTS conversion failed: {str(e)}"
        }, status=500)


async def voices_handler(request):
    """Return available voices."""
    try:
        voices = await edge_tts.list_voices()
        return web.json_response({"success": True, "voices": voices})
    except Exception as e:
        return web.json_response({
            "success": False,
            "message": f"Failed to fetch voices: {str(e)}"
        }, status=500)


async def health_handler(request):
    """Health check endpoint."""
    return web.json_response({"status": "ok"})


def main():
    parser = argparse.ArgumentParser(description="Edge TTS HTTP Service")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=18754, help="Port to bind to")
    parser.add_argument("--output-dir", default="tts", help="Output directory for audio files")
    args = parser.parse_args()

    app = web.Application()
    app.router.add_post("/tts", tts_handler)
    app.router.add_get("/voices", voices_handler)
    app.router.add_get("/health", health_handler)

    print(f"Starting Edge TTS service on http://{args.host}:{args.port}")
    print(f"Output directory: {args.output_dir}")
    print("Endpoints:")
    print(f"  POST /tts - Synthesize speech")
    print(f"  GET  /voices - List available voices")
    print(f"  GET  /health - Health check")

    web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
