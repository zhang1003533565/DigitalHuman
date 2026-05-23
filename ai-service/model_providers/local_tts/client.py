from __future__ import annotations

import asyncio
import os
import tempfile

from model_capabilities.tts.edge_tts_adapter import list_voice_short_names, synthesize_voice_to_file


class LocalTtsClient:
    async def list_voices(self) -> list[str]:
        return await list_voice_short_names()

    def test_voice(self, voice: str) -> int:
        async def synthesize() -> int:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
                tmp_path = tmp_file.name
            try:
                return await synthesize_voice_to_file("灵山胜境语音测试", voice, tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        return asyncio.run(synthesize())


def build_client() -> LocalTtsClient:
    return LocalTtsClient()
