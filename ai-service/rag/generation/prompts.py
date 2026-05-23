from __future__ import annotations

from rag.contracts.schemas import ChunkRecord


def build_grounded_answer(question: str, chunks: list[ChunkRecord]) -> str:
    if not chunks:
        return "当前知识库中没有检索到足够相关的资料，建议补充景区文档后再试。"

    summary_lines = []
    for chunk in chunks[:3]:
        section = " / ".join(chunk.payload.section_path) if chunk.payload.section_path else chunk.payload.title
        excerpt = chunk.text[:180].strip()
        summary_lines.append(f"来源《{chunk.payload.source_file}》[{section}]：{excerpt}")

    return (
        f"根据知识库检索，关于“{question}”可参考以下资料："
        + "；".join(summary_lines)
        + "。当前回答严格基于已入库内容整理，如需更自然的生成式回答，可以继续接入外部大模型。"
    )
