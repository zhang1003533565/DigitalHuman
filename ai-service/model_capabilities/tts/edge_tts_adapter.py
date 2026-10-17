from __future__ import annotations

import os
import asyncio
import traceback
import pyttsx3

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

try:
    import pythoncom
except ImportError:
    pythoncom = None


def _synthesize_sync_pyttsx3(text: str, output_path: str) -> None:
    """本地 pyttsx3 兜底逻辑（完全离线）"""
    if pythoncom:
        pythoncom.CoInitialize()
    try:
        engine = pyttsx3.init()
        # 尽量选择本地好听的中文音色
        try:
            voices = engine.getProperty("voices")
            for v in voices:
                if "Huihui" in v.name or "Yaoyao" in v.name:
                    engine.setProperty("voice", v.id)
                    break
        except Exception:
            pass
        engine.save_to_file(text, output_path)
        engine.runAndWait()
        engine.stop()
    except Exception as e:
        print(f"❌ [pyttsx3 兜底失败] {e}")
        raise e
    finally:
        if pythoncom:
            pythoncom.CoUninitialize()


async def synthesize_voice_to_file(
    text: str,
    voice: str,
    output_path: str,
    *,
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
) -> int:
    """优先尝试云端 edge-tts（高音质），失败则无缝降级到本地 pyttsx3"""
    if HAS_EDGE_TTS:
        try:
            print("🎙️ 尝试调用 edge-tts (真人感语音)...")
            communicate = edge_tts.Communicate(
                text,
                voice,
                rate=rate,
                volume=volume,
                pitch=pitch,
            )
            await communicate.save(output_path)
            print("✅ edge-tts 生成成功")
            return os.path.getsize(output_path)
        except Exception as e:
            print(f"⚠️ edge-tts 失败 ({e})，正在降级到本地语音...")

    # 兜底：使用本地 pyttsx3
    print("🔊 正在使用本地 pyttsx3 生成语音...")
    await asyncio.to_thread(_synthesize_sync_pyttsx3, text, output_path)
    return os.path.getsize(output_path)


async def list_voice_short_names() -> list[str]:
    return ["zh-CN-XiaoxiaoNeural"]