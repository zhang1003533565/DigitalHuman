from __future__ import annotations

import os

import edge_tts


async def synthesize_voice_to_file(
    text: str,
    voice: str,
    output_path: str,
    *,
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
) -> int:
    communicate = edge_tts.Communicate(
        text,
        voice,
        rate=rate,
        volume=volume,
        pitch=pitch,
    )
    await communicate.save(output_path)
    return os.path.getsize(output_path)


async def list_voice_short_names() -> list[str]:
    voices = await edge_tts.list_voices()
    return sorted(
        voice["ShortName"]
        for voice in voices
        if isinstance(voice, dict) and isinstance(voice.get("ShortName"), str)
    )
