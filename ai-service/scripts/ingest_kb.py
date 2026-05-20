#!/usr/bin/env python3

from rag.schemas import IngestRequest
from rag.service import RagService


def main() -> None:
    service = RagService()
    result = service.ingest(IngestRequest(recreate_collection=False))
    print(
        f"Indexed {result.files_indexed}/{result.files_seen} files into "
        f"{result.collection}, chunks={result.chunks_indexed}"
    )


if __name__ == "__main__":
    main()
